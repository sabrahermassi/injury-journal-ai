import { readJournalData } from '../../src/ingestion/reader/postgres-reader.js';
import { buildJournalDocuments } from '../../src/ingestion/documents/document-builder.js';
import {
  chunkDocuments,
  countTokens,
} from '../../src/ingestion/chunking/document-chunker.js';
import { prisma } from '../../src/lib/prisma.js';

describe('Ingestion pipeline integration', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('reads, builds, and chunks journal data', async () => {
    // 1. Read from PostgreSQL
    const journalData = await readJournalData();

    expect(journalData.length).toBeGreaterThan(0);

    // 2. Convert database records into JournalDocuments
    const documents = buildJournalDocuments(journalData);

    expect(documents.length).toBeGreaterThan(0);

    // 3. Chunk the documents
    const chunks = chunkDocuments(documents, 300);

    expect(chunks.length).toBeGreaterThan(0);

    // Every chunk should still have the information
    // needed to identify its original journal record.
    for (const chunk of chunks) {
      expect(chunk.content).toBeTruthy();

      expect(typeof chunk.metadata.userId).toBe('number');
      expect(typeof chunk.metadata.injuryId).toBe('number');
      expect(typeof chunk.metadata.sourceType).toBe('string');
      expect(typeof chunk.metadata.sourceId).toBe('number');
      expect(chunk.metadata.date).toBeInstanceOf(Date);

      expect(countTokens(chunk.content)).toBeLessThanOrEqual(300);
    }
  });
});
