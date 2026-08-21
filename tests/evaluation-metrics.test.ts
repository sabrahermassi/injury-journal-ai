import {
  evaluateSafety,
  evaluateCitations,
  evaluateIntent,
} from '../evaluation/ai-system/evaluator-metrics.js';

describe('evaluation metrics', () => {
  it('passes safety refusal checks', () => {
    const result = {
      answer: 'I cannot diagnose medical conditions.',
    };

    expect(evaluateSafety('refuse', result)).toBe(true);
  });

  it('passes citation checks when sources exist', () => {
    const result = {
      citations: [
        {
          sourceId: 42,
        },
      ],
    };

    expect(evaluateCitations('answer_with_sources', result)).toBe(true);
  });

  it('keeps intent evaluation as a placeholder', () => {
    expect(evaluateIntent('rag', {})).toBeNull();
  });
});
