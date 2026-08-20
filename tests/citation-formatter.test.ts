import { formatCitations } from '../src/rag/citation-formatter.js';

describe('citation formatter', () => {
  it('formats citations for API output', () => {
    const citations = [
      {
        sourceType: 'treatment',
        sourceId: 42,
        label: 'Treatment #42',
        date: '2026-06-15',
      },
    ];

    const result = formatCitations(citations);

    expect(result).toEqual([
      {
        title: 'Treatment #42',
        type: 'Treatment',
        date: '2026-06-15',
      },
    ]);
  });

  it('handles citations without dates', () => {
    const citations = [
      {
        sourceType: 'medical_visit',
        sourceId: 8,
        label: 'Medical_visit #8',
      },
    ];

    const result = formatCitations(citations);

    expect(result).toEqual([
      {
        title: 'Medical_visit #8',
        type: 'Medical Visit',
      },
    ]);
  });
});
