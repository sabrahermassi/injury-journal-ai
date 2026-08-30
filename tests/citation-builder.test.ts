import { buildCitations } from '../src/rag/citation-builder.js';

describe('citation builder', () => {
  it('maps retrieved chunks into citation objects', () => {
    const chunks = [
      {
        id: 15,
        sourceType: 'treatment',
        sourceId: 42,
        injuryId: 1,
        metadata: {
          date: '2026-06-15',
        },
      },
    ];

    const result = buildCitations(chunks, new Map([[1, 'Lower back pain']]));

    expect(result).toEqual([
      {
        sourceType: 'treatment',
        sourceId: 42,
        label: 'Treatment #42',
        injuryId: 1,
        injuryName: 'Lower back pain',
        date: '2026-06-15',
      },
    ]);
  });

  it('omits injuryName when the injury is not in the provided map', () => {
    const chunks = [
      {
        sourceType: 'treatment',
        sourceId: 42,
        injuryId: 1,
        metadata: {},
      },
    ];

    const result = buildCitations(chunks, new Map());

    expect(result).toEqual([
      {
        sourceType: 'treatment',
        sourceId: 42,
        label: 'Treatment #42',
        injuryId: 1,
      },
    ]);
  });

  it('deduplicates citations from the same source', () => {
    const chunks = [
      {
        sourceType: 'Treatment',
        sourceId: 42,
        injuryId: 1,
        metadata: {},
      },
      {
        sourceType: 'Treatment',
        sourceId: 42,
        injuryId: 1,
        metadata: {},
      },
    ];

    const citations = buildCitations(chunks, new Map());

    expect(citations).toHaveLength(1);
  });

  it('carries distinct injuryId per citation when chunks span multiple injuries (#208)', () => {
    const chunks = [
      {
        sourceType: 'timeline_event',
        sourceId: 2,
        injuryId: 1,
        metadata: {},
      },
      {
        sourceType: 'treatment',
        sourceId: 9,
        injuryId: 4,
        metadata: {},
      },
    ];

    const injuryNames = new Map([
      [1, 'Lower back pain'],
      [4, 'Right knee pain'],
    ]);

    const citations = buildCitations(chunks, injuryNames);

    expect(citations).toEqual([
      {
        sourceType: 'timeline_event',
        sourceId: 2,
        label: 'Timeline Event #2',
        injuryId: 1,
        injuryName: 'Lower back pain',
      },
      {
        sourceType: 'treatment',
        sourceId: 9,
        label: 'Treatment #9',
        injuryId: 4,
        injuryName: 'Right knee pain',
      },
    ]);
  });
});
