import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

type SearchSimilarChunk = Pick<
  Prisma.DocumentChunkGetPayload<Prisma.DocumentChunkDefaultArgs>,
  | 'id'
  | 'injuryId'
  | 'userId'
  | 'sourceType'
  | 'sourceId'
  | 'chunkIndex'
  | 'content'
  | 'metadata'
> & {
  distance: number;
};
export async function disconnectVectorStorage() {
  await prisma.$disconnect();
}

export async function storeDocumentChunk(
  injuryId: number,
  userId: number,
  sourceType: string,
  sourceId: number,
  chunkIndex: number,
  content: string,
  embedding: number[],
  metadata?: Record<string, unknown>,
): Promise<void> {
  const vector = `[${embedding.join(',')}]`;

  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO "DocumentChunk" (
        "injuryId",
        "userId",
        "sourceType",
        "sourceId",
        "chunkIndex",
        "content",
        "embedding",
        "metadata"
      )
      VALUES (
        ${injuryId},
        ${userId},
        ${sourceType},
        ${sourceId},
        ${chunkIndex},
        ${content},
        ${vector}::vector,
        ${metadata ? JSON.stringify(metadata) : null}::jsonb
      )
      ON CONFLICT ("sourceType", "sourceId", "chunkIndex")
      DO UPDATE SET
        "injuryId" = EXCLUDED."injuryId",
        "userId" = EXCLUDED."userId",
        "content" = EXCLUDED."content",
        "embedding" = EXCLUDED."embedding",
        "metadata" = EXCLUDED."metadata"
    `,
  );
}

export async function deleteDocumentChunksExcept(
  sourceType: string,
  sourceId: number,
  chunkIndexes: number[],
): Promise<void> {
  if (chunkIndexes.length === 0) {
    await prisma.$executeRaw(
      Prisma.sql`
        DELETE FROM "DocumentChunk"
        WHERE "sourceType" = ${sourceType}
          AND "sourceId" = ${sourceId}
      `,
    );

    return;
  }

  await prisma.$executeRaw(
    Prisma.sql`
      DELETE FROM "DocumentChunk"
      WHERE "sourceType" = ${sourceType}
        AND "sourceId" = ${sourceId}
        AND "chunkIndex" NOT IN (${Prisma.join(chunkIndexes)})
    `,
  );
}

export async function searchSimilarChunks(
  embedding: number[],
  injuryId?: number,
  limit = 5,
  sourceType?: string,
  userId?: number,
  requestId?: string,
) {
  void requestId; // unused for now — reserved for future log correlation (#32)

  const vector = `[${embedding.join(',')}]`;

  const filters: Prisma.Sql[] = [];
  if (injuryId !== undefined) filters.push(Prisma.sql`"injuryId" = ${injuryId}`);
  if (sourceType !== undefined) filters.push(Prisma.sql`"sourceType" = ${sourceType}`);
  if (userId !== undefined) filters.push(Prisma.sql`"userId" = ${userId}`);

  const whereClause =
    filters.length > 0 ? Prisma.sql`WHERE ${Prisma.join(filters, ' AND ')}` : Prisma.empty;

  return prisma.$queryRaw<SearchSimilarChunk[]>(
    Prisma.sql`
      SELECT
        "id",
        "injuryId",
        "userId",
        "sourceType",
        "sourceId",
        "chunkIndex",
        "content",
        "metadata",
        "embedding" <=> ${vector}::vector AS "distance"
      FROM "DocumentChunk"
      ${whereClause}
      ORDER BY "embedding" <=> ${vector}::vector
      LIMIT ${limit}
    `,
  );
}
