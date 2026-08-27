/*
  Backfill userId before making it NOT NULL.

  DocumentChunk.userId is denormalized from Injury.userId so that
  chunks can be filtered/indexed by user directly, without joining
  through Injury on every query.
*/

-- Add the column as nullable first.
ALTER TABLE "DocumentChunk"
ADD COLUMN "userId" INTEGER;

-- Backfill from the existing injuryId -> Injury.userId relationship.
UPDATE "DocumentChunk" AS dc
SET "userId" = i."userId"
FROM "Injury" AS i
WHERE i.id = dc."injuryId";

-- Now that every existing row has a value, make it required.
ALTER TABLE "DocumentChunk"
ALTER COLUMN "userId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "DocumentChunk_userId_idx" ON "DocumentChunk"("userId");
