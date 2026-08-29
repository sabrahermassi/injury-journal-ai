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

  it('passes intent checks when expected and actual intent match', () => {
    const result = { intent: 'rag' };

    expect(evaluateIntent('rag', result)).toBe(true);
  });

  it('fails intent checks when expected and actual intent differ', () => {
    const result = { intent: 'journal' };

    expect(evaluateIntent('rag', result)).toBe(false);
  });
});
