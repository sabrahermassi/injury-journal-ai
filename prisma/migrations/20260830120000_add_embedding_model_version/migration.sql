/*
  Track which embedding model (and model version) produced each chunk's
  vector, so retrieval can refuse to compare vectors from different
  models. `embedding` is `vector(1024)` with no other way to tell two
  vectors from different models apart, and cosine distance between them
  is meaningless.

  Backfilled from the model/version info already recorded (unindexed)
  inside `metadata.embedding`, with a fallback to the currently deployed
  model for any row that predates that metadata.
*/

-- Add the columns as nullable first.
ALTER TABLE "DocumentChunk"
ADD COLUMN "embeddingModel" TEXT,
ADD COLUMN "embeddingModelVersion" TEXT;

-- Backfill from metadata.embedding, falling back to the currently
-- deployed model for rows that never recorded it.
UPDATE "DocumentChunk"
SET
  "embeddingModel" = COALESCE(metadata->'embedding'->>'model', 'Qwen/Qwen3-Embedding-0.6B'),
  "embeddingModelVersion" = COALESCE(metadata->'embedding'->>'modelVersion', '97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3')
WHERE "embeddingModel" IS NULL;

-- Now that every existing row has a value, make both required.
ALTER TABLE "DocumentChunk"
ALTER COLUMN "embeddingModel" SET NOT NULL,
ALTER COLUMN "embeddingModelVersion" SET NOT NULL;

-- CreateIndex
CREATE INDEX "DocumentChunk_embeddingModel_embeddingModelVersion_idx" ON "DocumentChunk"("embeddingModel", "embeddingModelVersion");
