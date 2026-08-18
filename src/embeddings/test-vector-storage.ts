import { PrismaClient } from '@prisma/client';
import { embedText } from './embedding-client.js';
import { storeDocumentChunk } from './vector-storage.js';

const prisma = new PrismaClient();

const content = 'The patient received physiotherapy with limited improvement.';

const embeddingResult = await embedText(content);

await storeDocumentChunk(
  1,
  'treatment',
  1,
  content,
  embeddingResult.embedding,
  {
    userId: 1,
    injuryId: 1,
    sourceType: 'treatment',
    sourceId: 1,
    date: '2025-01-10',
    embedding: {
      model: embeddingResult.model,
      vectorDimension: embeddingResult.dimension,
      embeddingVersion: embeddingResult.version,
    },
  },
);

console.log('DocumentChunk stored successfully.');

await prisma.$disconnect();
