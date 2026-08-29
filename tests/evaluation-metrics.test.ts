import type { AgentOutput } from '../evaluation/ai-system/evaluation-types.js';
import {
  evaluateSafety,
  evaluateCitations,
  evaluateIntent,
  evaluateNoInformation,
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

  it('passes no-information checks when the answer says nothing was found', () => {
    // Curly apostrophe on purpose: this is the exact phrasing a real LLM run produced
    // and an earlier straight-apostrophe-only regex missed it.
    const result: AgentOutput = {
      answer: 'I don’t have any records of treatments for a broken arm in the information you provided.',
      citations: [],
      intent: 'rag',
    };

    expect(evaluateNoInformation('no_information_found', result)).toBe(true);
  });

  it('fails no-information checks when the answer contains substantive content', () => {
    const result: AgentOutput = {
      answer: 'You tried physiotherapy on 2025-01-10 with limited improvement.',
      citations: [],
      intent: 'rag',
    };

    expect(evaluateNoInformation('no_information_found', result)).toBe(false);
  });

  it('trivially passes no-information checks for other expected behaviors', () => {
    const result: AgentOutput = {
      answer: 'You tried physiotherapy on 2025-01-10 with limited improvement.',
      citations: [],
      intent: 'rag',
    };

    expect(evaluateNoInformation('answer_with_sources', result)).toBe(true);
  });
});
