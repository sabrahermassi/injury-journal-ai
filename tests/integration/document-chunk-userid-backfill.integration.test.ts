import { prisma } from '../../src/lib/prisma.js';
import { createTestInjury, deleteTestInjury } from './test-injury-fixuture.js';

/**
 * Exercises the exact backfill logic from
 * prisma/migrations/20260827032413_add_document_chunk_userid/migration.sql
 * against a row that predates the userId column (i.e. one inserted with
 * userId unset), since that migration has only ever run against databases
 * with zero pre-existing DocumentChunk rows and its backfill UPDATE has
 * never actually been exercised.
 */
describe('DocumentChunk userId backfill migration', () => {
  let injuryId: number;
  let userId: number;

  beforeAll(async () => {
    const testInjury = await createTestInjury('Backfill Migration Test');
    injuryId = testInjury.injuryId;
    userId = testInjury.userId;
  });

  afterAll(async () => {
    await deleteTestInjury(injuryId, userId);
  });

  it('derives userId from Injury.userId for a pre-existing row with no userId set', async () => {
    // Temporarily relax the NOT NULL constraint to simulate a row that
    // predates the userId column, then insert it with userId left NULL.
    await prisma.$executeRaw`
      ALTER TABLE "DocumentChunk" ALTER COLUMN "userId" DROP NOT NULL
    `;

    let chunkId: number;
    try {
      const inserted = await prisma.$queryRaw<{ id: number }[]>`
        INSERT INTO "DocumentChunk" (
          "injuryId", "sourceType", "sourceId", "chunkIndex", "content",
          "embeddingModel", "embeddingModelVersion"
        )
        VALUES (
          ${injuryId}, 'backfill-migration-test', 1, 0, 'pre-existing chunk',
          'test-model', 'v1'
        )
        RETURNING "id"
      `;
      chunkId = inserted[0].id;

      // Run the same backfill statement the migration uses.
      await prisma.$executeRaw`
        UPDATE "DocumentChunk" AS dc
        SET "userId" = i."userId"
        FROM "Injury" AS i
        WHERE i.id = dc."injuryId"
          AND dc."id" = ${chunkId}
      `;

      const [row] = await prisma.$queryRaw<{ userId: number }[]>`
        SELECT "userId" FROM "DocumentChunk" WHERE "id" = ${chunkId}
      `;

      expect(row.userId).toBe(userId);
    } finally {
      await prisma.$executeRaw`
        DELETE FROM "DocumentChunk" WHERE "sourceType" = 'backfill-migration-test'
      `;
      await prisma.$executeRaw`
        ALTER TABLE "DocumentChunk" ALTER COLUMN "userId" SET NOT NULL
      `;
    }
  });
});
