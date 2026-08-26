import { getEncoding } from 'js-tiktoken';
import {
  chunkDocument,
  chunkDocuments,
} from '../src/ingestion/chunking/document-chunker';
import type { JournalDocument } from '../src/ingestion/documents/document-types';

const encoding = getEncoding('cl100k_base');

function countTokens(text: string): number {
  return encoding.encode(text).length;
}

const smallDocument: JournalDocument = {
  content:
    'On 2025-03-01, the user received Shockwave therapy. Provider: Rehab Center. Reported outcome: No significant improvement.',
  metadata: {
    userId: 1,
    injuryId: 1,
    sourceType: 'treatment',
    sourceId: 2,
    date: new Date('2025-03-01'),
  },
};

const largeDocument: JournalDocument = {
  content: `
The user reported lower back pain after exercising. The pain was worse after prolonged standing.

The user received physiotherapy at a rehabilitation clinic. The treatment provided limited improvement.

The user later received shockwave therapy. The reported outcome was no significant improvement.
`
    .repeat(10)
    .trim(),
  metadata: {
    userId: 1,
    injuryId: 1,
    sourceType: 'medical_visit',
    sourceId: 1,
    date: new Date('2025-01-15'),
  },
};

const oversizedSentenceDocument: JournalDocument = {
  content:
    'The user reported persistent lower back pain after exercising and described burning discomfort spreading through the lower back and left hip with symptoms becoming significantly worse after prolonged standing, walking for extended periods, sitting for long periods, and performing physical activities that placed additional stress on the affected area, despite having previously tried several treatments without significant improvement.',
  metadata: {
    userId: 1,
    injuryId: 1,
    sourceType: 'medical_visit',
    sourceId: 1,
    date: new Date('2025-01-15'),
  },
};

describe('Document Chunker', () => {
  it('keeps a small document as a single chunk', () => {
    const chunks = chunkDocument(smallDocument, 100);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe(smallDocument.content);
  });

  it('splits a large document into chunks within the token limit', () => {
    const chunks = chunkDocument(largeDocument, 30);

    expect(chunks.length).toBeGreaterThan(1);

    chunks.forEach((chunk) => {
      expect(countTokens(chunk.content)).toBeLessThanOrEqual(30);
    });
  });

  it('preserves metadata for every chunk', () => {
    const chunks = chunkDocument(largeDocument, 30);

    chunks.forEach((chunk) => {
      expect(chunk.metadata).toEqual(largeDocument.metadata);
    });
  });

  it('flattens multiple documents', () => {
    const chunks = chunkDocuments([smallDocument, largeDocument], 30);

    expect(Array.isArray(chunks)).toBe(true);

    expect(chunks.every((chunk) => typeof chunk.content === 'string')).toBe(
      true,
    );

    expect(chunks.length).toBeGreaterThan(2);
  });

  it('produces no chunks for empty or whitespace-only content', () => {
    const emptyDocument: JournalDocument = {
      content: '   ',
      metadata: {
        userId: 1,
        injuryId: 1,
        sourceType: 'treatment',
        sourceId: 3,
        date: new Date('2025-03-01'),
      },
    };

    expect(chunkDocument(emptyDocument, 100)).toEqual([]);
  });

  it('splits a sentence that exceeds the token limit', () => {
    const chunks = chunkDocument(oversizedSentenceDocument, 20);

    console.log(chunks);

    expect(chunks.length).toBeGreaterThan(1);

    for (const chunk of chunks) {
      expect(countTokens(chunk.content)).toBeLessThanOrEqual(20);
    }
  });
});
