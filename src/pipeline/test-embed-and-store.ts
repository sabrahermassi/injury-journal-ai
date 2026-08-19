import { embedAndStoreDocument } from './embed-and-store.js';

const document = {
  content: 'The patient received physiotherapy with limited improvement.',
  metadata: {
    userId: 1,
    injuryId: 1,
    sourceType: 'treatment' as const,
    sourceId: 1,
    date: new Date('2025-01-10'),
  },
};

await embedAndStoreDocument(document);

console.log('Document embedded and stored successfully.');
