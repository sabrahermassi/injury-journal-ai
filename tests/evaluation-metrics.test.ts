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

  // The exact wording varies run to run even with an unchanged SYSTEM_PROMPT (see
  // prompt-builder.ts, updated in #183) -- these are all real phrasings a live Groq run
  // produced for the same question, so the regex targets the underlying "verb + negation"
  // structure rather than any single literal phrase.
  it.each([
    'I don’t have any records of treatments for a broken arm in the information you provided.',
    'The journal entries you shared do not mention a broken arm or any treatments for it.',
    'the journal data does not contain the needed detail to answer that.',
    'I’m sorry, but the journal data you provided does not include any information about treatments for a broken arm.',
  ])('passes no-information checks for real LLM phrasing: %s', (answer) => {
    const result: AgentOutput = { answer, citations: [], intent: 'rag' };

    expect(evaluateNoInformation('no_information_found', result)).toBe(true);
  });

  it('passes no-information checks for rag-service.ts\'s fixed no-relevant-context message (#122)', () => {
    const result: AgentOutput = {
      answer:
        'The journal does not contain information that closely matches this question. ' +
        'Try rephrasing it, or asking about a specific date or injury.',
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
