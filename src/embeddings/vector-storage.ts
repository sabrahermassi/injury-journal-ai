import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

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
// pgvector's `<=>` cosine distance operator ranges 0 (identical) to 2
// (opposite). Passing this as maxDistance disables the cutoff entirely —
// for callers (like injury-router.ts) that need the full distance spectrum
// because they apply their own, differently-calibrated distance logic.
export const MAX_COSINE_DISTANCE = 2;

// Default cosine distance cutoff for searchSimilarChunks. This is a
// conservative starting point, not a tuned value — issue #122 calls for
// tuning it against evaluation results once enough labeled retrieval data
// exists.
export const DEFAULT_DISTANCE_THRESHOLD = 0.7;

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
  embeddingModel: string,
  embeddingModelVersion: string,
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
        "embeddingModel",
        "embeddingModelVersion",
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
        ${embeddingModel},
        ${embeddingModelVersion},
        ${metadata ? JSON.stringify(metadata) : null}::jsonb
      )
      ON CONFLICT ("sourceType", "sourceId", "chunkIndex")
      DO UPDATE SET
        "injuryId" = EXCLUDED."injuryId",
        "userId" = EXCLUDED."userId",
        "content" = EXCLUDED."content",
        "embedding" = EXCLUDED."embedding",
        "embeddingModel" = EXCLUDED."embeddingModel",
        "embeddingModelVersion" = EXCLUDED."embeddingModelVersion",
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
  embeddingModel: string,
  embeddingModelVersion: string,
  injuryId?: number,
  limit = 5,
  sourceType?: string,
  userId?: number,
  requestId?: string,
  maxDistance = DEFAULT_DISTANCE_THRESHOLD,
) {
  void requestId; // unused for now — reserved for future log correlation (#32)

  const vector = `[${embedding.join(',')}]`;

  const filters: Prisma.Sql[] = [
    Prisma.sql`"embedding" <=> ${vector}::vector <= ${maxDistance}`,
    // Vectors from a different model (or model version) live in a
    // different space entirely — comparing them by cosine distance would
    // be meaningless. Only compare chunks embedded by the same model.
    Prisma.sql`"embeddingModel" = ${embeddingModel}`,
    Prisma.sql`"embeddingModelVersion" = ${embeddingModelVersion}`,
  ];
  if (injuryId !== undefined) filters.push(Prisma.sql`"injuryId" = ${injuryId}`);
  if (sourceType !== undefined) filters.push(Prisma.sql`"sourceType" = ${sourceType}`);
  if (userId !== undefined) filters.push(Prisma.sql`"userId" = ${userId}`);

  const whereClause = Prisma.sql`WHERE ${Prisma.join(filters, ' AND ')}`;

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
