/*
  Warnings:

  - A unique constraint covering the columns `[sourceType,sourceId,chunkIndex]` on the table `DocumentChunk` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `chunkIndex` to the `DocumentChunk` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "DocumentChunk" ADD COLUMN     "chunkIndex" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "DocumentChunk_sourceType_sourceId_chunkIndex_key" ON "DocumentChunk"("sourceType", "sourceId", "chunkIndex");
