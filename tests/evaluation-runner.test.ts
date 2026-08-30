import { jest } from '@jest/globals';
import dataset from '../evaluation/ai-system/dataset.json';

const runAgentMock = jest.fn();
const evaluateFaithfulnessMock = jest.fn();
const resolveExpectedSourcesMock = jest.fn();
const evaluateBlendedVerdictMock = jest.fn();

jest.unstable_mockModule('../src/ai-agent/ai-agent-orchestrator.js', () => ({
  runAgent: runAgentMock,
}));

jest.unstable_mockModule('../evaluation/ai-system/faithfulness-judge.js', () => ({
  evaluateFaithfulness: evaluateFaithfulnessMock,
}));

jest.unstable_mockModule('../evaluation/ai-system/resolve-expected-sources.js', () => ({
  resolveExpectedSources: resolveExpectedSourcesMock,
}));

jest.unstable_mockModule('../evaluation/ai-system/blended-verdict-judge.js', () => ({
  evaluateBlendedVerdict: evaluateBlendedVerdictMock,
}));

const { runEvaluation } =
  await import('../evaluation/ai-system/evaluation-runner.js');

describe('evaluation runner', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    evaluateFaithfulnessMock.mockResolvedValue(true);
    resolveExpectedSourcesMock.mockResolvedValue([]);
    evaluateBlendedVerdictMock.mockResolvedValue(true);
  });

  it('runs evaluation questions through the AI agent', async () => {
    runAgentMock.mockResolvedValue({
      answer: 'Shockwave therapy failed.',
      citations: [],
    });

    const results = await runEvaluation();

    expect(runAgentMock).toHaveBeenCalledTimes(dataset.length);

    for (const item of dataset) {
      expect(runAgentMock).toHaveBeenCalledWith(
        item.question,
        item.userId,
        item.injuryId,
      );
    }

    expect(results.length).toBeGreaterThan(0);

    expect(results[0]).toHaveProperty('id');
    expect(results[0]).toHaveProperty('output');
  });

  it('runs the faithfulness judge for each case with the agent answer and chunks', async () => {
    runAgentMock.mockResolvedValue({
      answer: 'Shockwave therapy failed.',
      citations: [],
      metadata: {
        retrievedChunks: [{ sourceType: 'treatment', sourceId: 42 }],
      },
    });

    const results = await runEvaluation();

    expect(evaluateFaithfulnessMock).toHaveBeenCalledTimes(dataset.length);

    for (const item of dataset) {
      expect(evaluateFaithfulnessMock).toHaveBeenCalledWith(
        item.expectedBehavior,
        'Shockwave therapy failed.',
        [{ sourceType: 'treatment', sourceId: 42 }],
      );
    }

    expect(results[0].evaluation).toHaveProperty('faithfulnessPassed', true);
  });

  it('contains an expected-source resolution failure to that case instead of aborting the run', async () => {
    runAgentMock.mockResolvedValue({
      answer: 'Shockwave therapy failed.',
      citations: [],
    });

    resolveExpectedSourcesMock.mockRejectedValueOnce(
      new Error('no treatment matching "Shockwave therapy" found'),
    );

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const results = await runEvaluation();

    expect(results.length).toBe(dataset.length);
    expect(results[0].evaluation.retrievalPassed).toBeNull();
    expect(results[1].evaluation.retrievalPassed).not.toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('no treatment matching "Shockwave therapy" found'),
    );

    consoleErrorSpy.mockRestore();
  });

  it('runs the blended-verdict judge for each case with the agent answer and chunks', async () => {
    runAgentMock.mockResolvedValue({
      answer: 'Shockwave therapy failed.',
      citations: [],
      metadata: {
        retrievedChunks: [{ sourceType: 'treatment', sourceId: 42, injuryId: 1 }],
      },
    });

    const results = await runEvaluation();

    expect(evaluateBlendedVerdictMock).toHaveBeenCalledTimes(dataset.length);

    for (const item of dataset) {
      expect(evaluateBlendedVerdictMock).toHaveBeenCalledWith(
        item.expectedBehavior,
        'Shockwave therapy failed.',
        [{ sourceType: 'treatment', sourceId: 42, injuryId: 1 }],
      );
    }

    expect(results[0].evaluation).toHaveProperty('blendedVerdictPassed', true);
  });
});
