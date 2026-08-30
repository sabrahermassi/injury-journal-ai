import { jest } from '@jest/globals';
import { getEncoding } from 'js-tiktoken';
import {
  chunkDocument,
  chunkDocuments,
  QWEN_SAFETY_MARGIN,
  resolveChunkBudget,
} from '../src/ingestion/chunking/document-chunker';
import type {
  DocumentSourceType,
  JournalDocument,
} from '../src/ingestion/documents/document-types';
import {
  buildJournalDocuments,
  type InjuryWithRelations,
} from '../src/ingestion/documents/document-builder';

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

    // overlapTokens: 0 isolates hard-split correctness from the overlap
    // feature — with overlap enabled, duplicated text between pieces makes
    // a naive join()/toContain() check unreliable.
    const chunks = chunkDocument(oversizedWordDocument, 20, 0);

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

    // overlapTokens: 0 isolates hard-split correctness from the overlap
    // feature — see the comment on the previous test.
    const chunks = chunkDocument(oversizedWordDocument, 20, 0);

    expect(chunks.length).toBeGreaterThan(1);

    for (const chunk of chunks) {
      expect(countTokens(chunk.content)).toBeLessThanOrEqual(20);
      expect(chunk.content).not.toContain('�');
    }

    expect(chunks.map((chunk) => chunk.content).join('')).toContain(longWord);
  });

  // Longest run of trailing chars in `prev` that also prefixes `curr` —
  // char-level counterpart of overlapWordCount below, for content with no
  // whitespace to split on (oversized single "words").
  function overlapCharCount(prev: string, curr: string): number {
    const prevChars = Array.from(prev);
    const currChars = Array.from(curr);
    const maxLen = Math.min(prevChars.length, currChars.length);

    for (let len = maxLen; len > 0; len--) {
      const suffix = prevChars.slice(prevChars.length - len).join('');
      const prefix = currChars.slice(0, len).join('');
      if (suffix === prefix) {
        return len;
      }
    }

    return 0;
  }

  it('repeats trailing text between consecutive pieces of an oversized word', () => {
    // A non-periodic digit sequence: long enough to force several oversized
    // pieces, but with no repeating pattern that would make the overlap
    // check below trivially pass regardless of correctness.
    const longWord = Array.from({ length: 400 }, (_, i) =>
      String.fromCharCode(48 + ((i * 37 + i * i) % 10)),
    ).join('');
    const oversizedWordDocument: JournalDocument = {
      content: `Short intro sentence here. ${longWord} tail.`,
      metadata: oversizedSentenceDocument.metadata,
    };

    const chunks = chunkDocument(oversizedWordDocument, 20, 5);

    expect(chunks.length).toBeGreaterThan(2);

    for (const chunk of chunks) {
      expect(countTokens(chunk.content)).toBeLessThanOrEqual(20);
    }

    // First chunk holds "Short intro sentence here." and the overlap seed
    // it hands to the first word piece; every piece after that is a pure
    // slice of longWord, so check overlap across those.
    const wordPieces = chunks.slice(1, -1);
    expect(wordPieces.length).toBeGreaterThan(1);

    for (let i = 1; i < wordPieces.length; i++) {
      expect(
        overlapCharCount(wordPieces[i - 1].content, wordPieces[i].content),
      ).toBeGreaterThan(0);
    }
  });

  it('splits against a reduced budget to guard against tokenizer mismatch (#136)', () => {
    // document-chunker.ts counts tokens with cl100k_base but embeddings use
    // Qwen3-Embedding-0.6B's own tokenizer, which measured up to ~16.7% more
    // tokens on the same text (QWEN_SAFETY_MARGIN = 0.82). Chunks should stay
    // under the reduced effective budget, not just under maxTokens itself.
    const maxTokens = 30;
    const effectiveMaxTokens = Math.floor(maxTokens * QWEN_SAFETY_MARGIN);

    const chunks = chunkDocument(largeDocument, maxTokens);

    chunks.forEach((chunk) => {
      expect(countTokens(chunk.content)).toBeLessThanOrEqual(effectiveMaxTokens);
    });
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
    // maxTokens: 40 (not 30) leaves enough room under the QWEN_SAFETY_MARGIN-
    // reduced effective budget (~32 tokens) for a 10-token overlap seed to
    // fit alongside this document's ~17-24 token sentences.
    const chunks = chunkDocument(largeDocument, 40, 10);

    expect(chunks.length).toBeGreaterThan(1);

    for (let i = 1; i < chunks.length; i++) {
      expect(
        overlapWordCount(chunks[i - 1].content, chunks[i].content),
      ).toBeGreaterThan(0);
    }
  });

  it('stays within the token limit even with overlap seeded in', () => {
    const chunks = chunkDocument(largeDocument, 40, 10);

    chunks.forEach((chunk) => {
      expect(countTokens(chunk.content)).toBeLessThanOrEqual(40);
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

  describe('overlap-drop logging (#216)', () => {
    let debugSpy: jest.SpiedFunction<typeof console.debug>;

    beforeEach(() => {
      debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    });

    afterEach(() => {
      debugSpy.mockRestore();
    });

    it('logs a debug summary when an overlap seed does not fit alongside the next content', () => {
      // maxTokens: 27 -> effectiveMaxTokens ~22, with overlapTokens: 15 the
      // seed alone can nearly fill that budget, leaving too little room for
      // most of this document's ~17-24 token sentences: the seeded
      // candidate overflows and falls back to unseeded content.
      chunkDocument(largeDocument, 27, 15);

      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining('dropped overlap'),
      );
    });

    it('does not log when overlapTokens is 0 (no seed to drop)', () => {
      chunkDocument(largeDocument, 30, 0);

      expect(debugSpy).not.toHaveBeenCalled();
    });
  });

  describe('source-type-aware chunking config', () => {
    // A local, literal config — never SOURCE_TYPE_CHUNK_CONFIG itself, which
    // is Readonly and shared across the whole module — so this test exercises
    // resolveChunkBudget's per-sourceType differentiation without mutating
    // any global state.
    const localTestConfig: Record<
      DocumentSourceType,
      Readonly<{ maxTokens: number; overlapTokens?: number }>
    > = {
      injury: { maxTokens: 300 },
      symptom: { maxTokens: 300 },
      treatment: { maxTokens: 30, overlapTokens: 0 },
      medical_visit: { maxTokens: 300, overlapTokens: 5 },
      timeline_event: { maxTokens: 300 },
    };

    it('resolves each sourceType to its own configured budget when no override is passed', () => {
      expect(
        resolveChunkBudget('treatment', undefined, undefined, localTestConfig),
      ).toEqual({ maxTokens: 30, overlapTokens: 0 });

      expect(
        resolveChunkBudget(
          'medical_visit',
          undefined,
          undefined,
          localTestConfig,
        ),
      ).toEqual({ maxTokens: 300, overlapTokens: 5 });
    });

    it('lets an explicit maxTokens/overlapTokens override the sourceType default', () => {
      expect(
        resolveChunkBudget('treatment', 30, 0, localTestConfig),
      ).toEqual({ maxTokens: 30, overlapTokens: 0 });

      const treatmentVariant: JournalDocument = {
        ...largeDocument,
        metadata: { ...largeDocument.metadata, sourceType: 'treatment' },
      };

      const chunks = chunkDocument(treatmentVariant, 30, 0);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk) => {
        expect(countTokens(chunk.content)).toBeLessThanOrEqual(30);
      });
    });

    it('chunkDocument reaches the real SOURCE_TYPE_CHUNK_CONFIG when no arguments are passed', () => {
      // Wiring smoke test: no other test calls chunkDocument with a single
      // argument, so this proves resolveChunkBudget is actually threaded
      // through to the module's real (Readonly) config end-to-end.
      const chunks = chunkDocument(smallDocument);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe(smallDocument.content);
    });

    it('chunkDocuments resolves each document\'s own sourceType config independently', () => {
      const treatmentVariant: JournalDocument = {
        ...smallDocument,
        metadata: { ...smallDocument.metadata, sourceType: 'treatment' },
      };
      const medicalVisitVariant: JournalDocument = {
        ...smallDocument,
        content: 'A short medical visit summary for this test.',
        metadata: { ...smallDocument.metadata, sourceType: 'medical_visit' },
      };

      const chunks = chunkDocuments([treatmentVariant, medicalVisitVariant]);

      expect(chunks).toHaveLength(2);
      expect(chunks[0].content).toBe(treatmentVariant.content);
      expect(chunks[1].content).toBe(medicalVisitVariant.content);
    });
  });

  describe('field-boundary splitting', () => {
    const labeledFieldsDocument: JournalDocument = {
      content:
        'On 2025-01-15, the user had a medical visit. ' +
        'Doctor: Dr. Alvarez. ' +
        'Clinic: Downtown Physical Therapy. ' +
        'Notes: The patient reported ongoing lower back pain that worsens ' +
        'with prolonged sitting and standing, and described intermittent ' +
        'numbness radiating down the left leg during physical activity.',
      metadata: {
        userId: 1,
        injuryId: 1,
        sourceType: 'medical_visit',
        sourceId: 5,
        date: new Date('2025-01-15'),
      },
    };

    it('splits an oversized record on labeled-field boundaries before sentence-splitting', () => {
      const chunks = chunkDocument(labeledFieldsDocument, 20, 0);

      expect(chunks.length).toBeGreaterThan(1);

      // At least one chunk boundary lands on a field label rather than mid
      // way through the "Notes:" sentence run.
      expect(
        chunks.some((chunk) => /^(Doctor|Clinic|Notes):/.test(chunk.content)),
      ).toBe(true);
    });

    it('keeps field-split chunks within the token limit', () => {
      const chunks = chunkDocument(labeledFieldsDocument, 20, 0);

      chunks.forEach((chunk) => {
        expect(countTokens(chunk.content)).toBeLessThanOrEqual(20);
      });
    });

    it('honors overlapTokens across a field-split boundary', () => {
      const chunks = chunkDocument(labeledFieldsDocument, 25, 8);

      expect(chunks.length).toBeGreaterThan(1);

      let sawOverlap = false;
      for (let i = 1; i < chunks.length; i++) {
        if (overlapWordCount(chunks[i - 1].content, chunks[i].content) > 0) {
          sawOverlap = true;
        }
        expect(countTokens(chunks[i].content)).toBeLessThanOrEqual(25);
      }
      expect(sawOverlap).toBe(true);
    });

    it('logs a dropped-overlap boundary discovered while iterating multiple fields (#216)', () => {
      // maxTokens: 21 -> effectiveMaxTokens 17. This document has 4 labeled
      // fields, so processFields takes its multi-field loop (not the
      // fields.length<=1 shortcut the other overlap-drop tests exercise) and
      // the oversized "Notes:" field falls through to processSentences,
      // where a word-level seed doesn't fit alongside the next word. This
      // specifically covers processFields forwarding processSentences'
      // droppedOverlap count across loop iterations.
      const debugSpy = jest
        .spyOn(console, 'debug')
        .mockImplementation(() => {});

      try {
        chunkDocument(labeledFieldsDocument, 21, 16);

        expect(debugSpy).toHaveBeenCalledWith(
          expect.stringContaining('dropped overlap'),
        );
      } finally {
        debugSpy.mockRestore();
      }
    });

    it('logs a dropped-overlap boundary at a field-alone fallback (#221)', () => {
      // maxTokens: 21 -> effectiveMaxTokens 17. Two labeled fields, each of
      // which fits effectiveMaxTokens alone (12 and 10 tokens) but not
      // together (21 tokens combined), forcing a chunk save between them.
      // With overlapTokens: 10 the carried-forward seed (10 tokens) plus
      // the second field (10 tokens) exceeds 17, so the drop happens in
      // processFields' own field-alone fallback — unlike the #216 test
      // above, this field never falls through to processSentences.
      const twoFieldDocument: JournalDocument = {
        content:
          'Doctor: Dr. Alvarez ran a full physical exam today. ' +
          'Clinic: Downtown Physical Therapy building on Main.',
        metadata: {
          userId: 1,
          injuryId: 1,
          sourceType: 'medical_visit',
          sourceId: 6,
          date: new Date('2025-01-15'),
        },
      };

      const debugSpy = jest
        .spyOn(console, 'debug')
        .mockImplementation(() => {});

      try {
        chunkDocument(twoFieldDocument, 21, 10);

        expect(debugSpy).toHaveBeenCalledWith(
          expect.stringContaining('dropped overlap'),
        );
      } finally {
        debugSpy.mockRestore();
      }
    });

    it('splits real document-builder.ts output on its own field labels', () => {
      // Runs actual buildJournalDocuments() output through the chunker,
      // rather than a hand-typed literal, so a label rename in
      // document-builder.ts (Doctor:/Clinic:/Notes:) breaks this test
      // instead of silently degrading to sentence-only splitting.
      const injuryFixture: InjuryWithRelations = {
        id: 1,
        name: 'Lower back strain',
        bodyArea: 'lower back',
        side: null,
        startDate: new Date('2025-01-01'),
        cause: null,
        description: null,
        status: null,
        userId: 1,
        Symptom: [],
        Treatment: [],
        MedicalVisit: [
          {
            id: 7,
            doctor: 'Dr. Alvarez',
            clinic: 'Downtown Physical Therapy',
            date: new Date('2025-01-15'),
            notes:
              'The patient reported ongoing lower back pain that worsens ' +
              'with prolonged sitting and standing, and described ' +
              'intermittent numbness radiating down the left leg during ' +
              'physical activity.',
          },
        ],
        TimelineEvent: [],
      };

      const [medicalVisitDocument] = buildJournalDocuments([
        injuryFixture,
      ]).filter((document) => document.metadata.sourceType === 'medical_visit');

      const chunks = chunkDocument(medicalVisitDocument, 20, 0);

      expect(chunks.length).toBeGreaterThan(1);
      expect(
        chunks.some((chunk) => /^(Doctor|Clinic|Notes):/.test(chunk.content)),
      ).toBe(true);
    });
  });
});
