import { evaluateRetrieval } from '../evaluation/ai-system/retrieval-metrics.js';

describe('retrieval metrics', () => {
  it('passes when expected sources are retrieved', () => {
    const expectedSources = [
      {
        sourceType: 'treatment',
        sourceId: 42,
      },
    ];

    const retrievedChunks = [
      {
        sourceType: 'treatment',
        sourceId: 42,
      },
      {
        sourceType: 'symptom',
        sourceId: 10,
      },
    ];

    expect(evaluateRetrieval(expectedSources, retrievedChunks)).toBe(true);
  });

  it('fails when expected sources are missing', () => {
    const expectedSources = [
      {
        sourceType: 'treatment',
        sourceId: 42,
      },
    ];

    const retrievedChunks = [
      {
        sourceType: 'treatment',
        sourceId: 10,
      },
    ];

    expect(evaluateRetrieval(expectedSources, retrievedChunks)).toBe(false);
  });
});
