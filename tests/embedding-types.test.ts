import type { EmbeddedDocument } from '../src/embeddings/embedding-types';
import type { JournalDocument } from '../src/ingestion/documents/document-types';

const journalDocument: JournalDocument = {
  content: 'The user reported burning pain in the lower back and left hip.',
  metadata: {
    userId: 1,
    injuryId: 1,
    sourceType: 'symptom',
    sourceId: 1,
    date: new Date('2026-01-01'),
  },
};

describe('EmbeddedDocument', () => {
  it('accepts a fully populated embedded document', () => {
    const embeddedDocument: EmbeddedDocument = {
      document: journalDocument,
      embedding: [0.1, 0.2, 0.3],
      embeddingMetadata: {
        model: 'Qwen/Qwen3-Embedding-0.6B',
        modelVersion: '1.0',
        vectorDimension: 1024,
        embeddingVersion: 'qwen3-embedding-0.6b-v1',
      },
    };

    expect(embeddedDocument.document).toEqual(journalDocument);
    expect(Array.isArray(embeddedDocument.embedding)).toBe(true);
    expect(embeddedDocument.embedding).toHaveLength(3);
    expect(embeddedDocument.embeddingMetadata).toEqual({
      model: 'Qwen/Qwen3-Embedding-0.6B',
      modelVersion: '1.0',
      vectorDimension: 1024,
      embeddingVersion: 'qwen3-embedding-0.6b-v1',
    });
  });

  it('preserves the original journal document fields, including metadata', () => {
    const embeddedDocument: EmbeddedDocument = {
      document: journalDocument,
      embedding: [],
      embeddingMetadata: {
        model: 'test-model',
        modelVersion: 'v0',
        vectorDimension: 0,
        embeddingVersion: 'v0',
      },
    };

    expect(embeddedDocument.document.metadata.sourceType).toBe('symptom');
    expect(embeddedDocument.document.metadata.userId).toBe(1);
    expect(embeddedDocument.document.metadata.date).toBeInstanceOf(Date);
  });

  it('supports an empty embedding vector', () => {
    const embeddedDocument: EmbeddedDocument = {
      document: journalDocument,
      embedding: [],
      embeddingMetadata: {
        model: 'test-model',
        modelVersion: 'v0',
        vectorDimension: 1024,
        embeddingVersion: 'v0',
      },
    };

    expect(embeddedDocument.embedding).toEqual([]);
  });

  it('supports high-dimensional embedding vectors', () => {
    const largeVector = Array.from({ length: 1024 }, (_, i) => i / 1024);

    const embeddedDocument: EmbeddedDocument = {
      document: journalDocument,
      embedding: largeVector,
      embeddingMetadata: {
        model: 'Qwen/Qwen3-Embedding-0.6B',
        modelVersion: '1.0',
        vectorDimension: 1024,
        embeddingVersion: 'qwen3-embedding-0.6b-v1',
      },
    };

    expect(embeddedDocument.embedding).toHaveLength(1024);
    expect(embeddedDocument.embeddingMetadata.vectorDimension).toBe(
      embeddedDocument.embedding.length,
    );
  });
});