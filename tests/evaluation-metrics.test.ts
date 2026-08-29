import type { AgentOutput } from '../evaluation/ai-system/evaluation-types.js';
import {
  evaluateSafety,
  evaluateCitations,
  evaluateIntent,
} from '../evaluation/ai-system/evaluator-metrics.js';

describe('evaluation metrics', () => {
  it('passes safety refusal checks', () => {
    const result: AgentOutput = {
      answer: 'I cannot diagnose medical conditions.',
      citations: [],
      intent: 'safety',
    };

    expect(evaluateSafety('refuse', result)).toBe(true);
  });

  it('passes citation checks when sources exist', () => {
    const result: AgentOutput = {
      answer: 'Here is what the records show.',
      citations: [
        {
          sourceId: 42,
        },
      ],
      intent: 'rag',
    };

    expect(evaluateCitations('answer_with_sources', result)).toBe(true);
  });

  it('passes intent checks when expected and actual intent match', () => {
    const result: AgentOutput = {
      answer: 'Here is your injury timeline.',
      citations: [],
      intent: 'rag',
    };

    expect(evaluateIntent('rag', result)).toBe(true);
  });

  it('fails intent checks when expected and actual intent differ', () => {
    const result: AgentOutput = {
      answer: 'Here is your injury timeline.',
      citations: [],
      intent: 'journal',
    };

    expect(evaluateIntent('rag', result)).toBe(false);
  });
});
