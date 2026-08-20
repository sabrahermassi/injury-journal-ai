import { buildCitations } from '../src/rag/citation-builder.js';

describe('citation builder', () => {
  it('maps retrieved chunks into citation objects', () => {
    const chunks = [
      {
        id: 15,
        sourceType: 'treatment',
        sourceId: 42,
        metadata: {
          date: '2026-06-15',
        },
      },
    ];

    const result = buildCitations(chunks);

    expect(result).toEqual([
      {
        sourceType: 'treatment',
        sourceId: 42,
        label: 'Treatment #42',
        date: '2026-06-15',
      },
    ]);
  });

  it('deduplicates citations from the same source', () => {
    const chunks = [
      {
        sourceType: 'Treatment',
        sourceId: 42,
        metadata: {},
      },
      {
        sourceType: 'Treatment',
        sourceId: 42,
        metadata: {},
      },
    ];

    const citations = buildCitations(chunks);

    expect(citations).toHaveLength(1);
  });
});
