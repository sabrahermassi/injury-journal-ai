import { embedText } from './embedding-client.js';
import {
  storeDocumentChunk,
  disconnectVectorStorage,
} from './vector-storage.js';

const content = 'The patient received physiotherapy with limited improvement.';

const embeddingResult = await embedText(content);

await storeDocumentChunk(
  7,
  'treatment',
  7,
  content,
  embeddingResult.embedding,
  {
    userId: 7,
    injuryId: 7,
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

await disconnectVectorStorage();
