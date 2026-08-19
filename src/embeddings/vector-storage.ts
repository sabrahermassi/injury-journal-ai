import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export async function disconnectVectorStorage() {
  await prisma.$disconnect();
}

export async function storeDocumentChunk(
  injuryId: number,
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
        "sourceType",
        "sourceId",
        "chunkIndex",
        "content",
        "embedding",
        "metadata"
      )
      VALUES (
        ${injuryId},
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
        "content" = EXCLUDED."content",
        "embedding" = EXCLUDED."embedding",
        "metadata" = EXCLUDED."metadata"
    `,
  );
}
