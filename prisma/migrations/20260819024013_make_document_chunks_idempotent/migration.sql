/*
  Backfill chunkIndex before making it NOT NULL.

  Existing chunks are numbered independently within each
  (sourceType, sourceId) group so that the unique constraint
  on (sourceType, sourceId, chunkIndex) can be created safely.
*/

-- Add the column as nullable first.
ALTER TABLE "DocumentChunk"
ADD COLUMN "chunkIndex" INTEGER;

-- Number existing chunks within each document/source.
WITH numbered_chunks AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "sourceType", "sourceId"
      ORDER BY id
    ) - 1 AS "chunkIndex"
  FROM "DocumentChunk"
)
UPDATE "DocumentChunk" AS dc
SET "chunkIndex" = nc."chunkIndex"
FROM numbered_chunks AS nc
WHERE dc.id = nc.id;

-- Now that every existing row has a value, make it required.
ALTER TABLE "DocumentChunk"
ALTER COLUMN "chunkIndex" SET NOT NULL;

-- Enforce idempotency.
CREATE UNIQUE INDEX "DocumentChunk_sourceType_sourceId_chunkIndex_key"
ON "DocumentChunk"("sourceType", "sourceId", "chunkIndex");
