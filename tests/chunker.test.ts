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
  it('returns no chunks for whitespace-only content', () => {
    const whitespaceDocument: JournalDocument = {
      ...smallDocument,
      content: '   \n\t  ',
    };

    expect(chunkDocument(whitespaceDocument, 100)).toHaveLength(0);
  });

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

  it('keeps multiple small documents separate', () => {
    const secondDocument: JournalDocument = {
      ...smallDocument,
      content: 'A second short journal entry with unrelated content.',
      metadata: { ...smallDocument.metadata, sourceId: 3 },
    };
    const thirdDocument: JournalDocument = {
      ...smallDocument,
      content: 'A third short journal entry, also unrelated.',
      metadata: { ...smallDocument.metadata, sourceId: 4 },
    };

    const chunks = chunkDocuments(
      [smallDocument, secondDocument, thirdDocument],
      100,
    );

    expect(chunks).toHaveLength(3);
    expect(chunks[0].content).toBe(smallDocument.content);
    expect(chunks[1].content).toBe(secondDocument.content);
    expect(chunks[2].content).toBe(thirdDocument.content);
  });

  it('does not split chunks mid-sentence', () => {
    const chunks = chunkDocument(largeDocument, 30);

    chunks.forEach((chunk) => {
      expect(chunk.content.trim()).toMatch(/[.!?]$/);
    });
  });

  it('does not create chunks for empty content', () => {
    const emptyDocument: JournalDocument = {
      ...smallDocument,
      content: '',
    };

    const chunks = chunkDocument(emptyDocument, 100);

    expect(chunks).toHaveLength(0);
  });

  it('flattens multiple documents', () => {
    const chunks = chunkDocuments([smallDocument, largeDocument], 30);

    expect(Array.isArray(chunks)).toBe(true);

    expect(chunks.every((chunk) => typeof chunk.content === 'string')).toBe(
      true,
    );

    expect(chunks.length).toBeGreaterThan(2);
  });

  it('splits a sentence that exceeds the token limit', () => {
    const chunks = chunkDocument(oversizedSentenceDocument, 20);

    expect(chunks.length).toBeGreaterThan(1);

    for (const chunk of chunks) {
      expect(countTokens(chunk.content)).toBeLessThanOrEqual(20);
    }
  });

  it('splits a single word that exceeds the token limit', () => {
    const longWord = 'a'.repeat(400);
    const oversizedWordDocument: JournalDocument = {
      content: `Short intro sentence here. ${longWord} tail.`,
      metadata: oversizedSentenceDocument.metadata,
    };

    const chunks = chunkDocument(oversizedWordDocument, 20);

    expect(chunks.length).toBeGreaterThan(1);

    for (const chunk of chunks) {
      expect(countTokens(chunk.content)).toBeLessThanOrEqual(20);
    }

    expect(chunks.map((chunk) => chunk.content).join('')).toContain(longWord);
  });

  it('splits an oversized multi-byte word without corrupting characters', () => {
    const longWord = '日本語テスト'.repeat(40);
    const oversizedWordDocument: JournalDocument = {
      content: `Short intro sentence here. ${longWord} tail.`,
      metadata: oversizedSentenceDocument.metadata,
    };

    const chunks = chunkDocument(oversizedWordDocument, 20);

    expect(chunks.length).toBeGreaterThan(1);

    for (const chunk of chunks) {
      expect(countTokens(chunk.content)).toBeLessThanOrEqual(20);
      expect(chunk.content).not.toContain('�');
    }

    expect(chunks.map((chunk) => chunk.content).join('')).toContain(longWord);
  });

  it('rejects a maxTokens value below one', () => {
    expect(() => chunkDocument(smallDocument, 0)).toThrow();
    expect(() => chunkDocument(smallDocument, -1)).toThrow();
    expect(() => chunkDocument(smallDocument, NaN)).toThrow();
  });

  it('rejects an invalid overlapTokens value', () => {
    expect(() => chunkDocument(largeDocument, 30, -1)).toThrow();
    expect(() => chunkDocument(largeDocument, 30, NaN)).toThrow();
    expect(() => chunkDocument(largeDocument, 30, 30)).toThrow();
    expect(() => chunkDocument(largeDocument, 30, 40)).toThrow();
  });

  // Longest run of trailing words in `prev` that also prefixes `curr`.
  function overlapWordCount(prev: string, curr: string): number {
    const prevWords = prev.split(/\s+/);
    const currWords = curr.split(/\s+/);
    const maxLen = Math.min(prevWords.length, currWords.length);

    for (let len = maxLen; len > 0; len--) {
      const suffix = prevWords.slice(prevWords.length - len).join(' ');
      const prefix = currWords.slice(0, len).join(' ');
      if (suffix === prefix) {
        return len;
      }
    }

    return 0;
  }

  it('repeats trailing text from one chunk at the start of the next', () => {
    const chunks = chunkDocument(largeDocument, 30, 10);

    expect(chunks.length).toBeGreaterThan(1);

    for (let i = 1; i < chunks.length; i++) {
      expect(
        overlapWordCount(chunks[i - 1].content, chunks[i].content),
      ).toBeGreaterThan(0);
    }
  });

  it('stays within the token limit even with overlap seeded in', () => {
    const chunks = chunkDocument(largeDocument, 30, 10);

    chunks.forEach((chunk) => {
      expect(countTokens(chunk.content)).toBeLessThanOrEqual(30);
    });
  });

  it('produces no overlap when overlapTokens is 0', () => {
    const chunks = chunkDocument(largeDocument, 30, 0);

    expect(chunks.length).toBeGreaterThan(1);

    for (let i = 1; i < chunks.length; i++) {
      expect(overlapWordCount(chunks[i - 1].content, chunks[i].content)).toBe(
        0,
      );
    }
  });
});
