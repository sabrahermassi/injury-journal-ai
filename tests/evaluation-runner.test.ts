import { jest } from '@jest/globals';
import dataset from '../evaluation/ai-system/dataset.json';

const runAgentMock = jest.fn();
const evaluateFaithfulnessMock = jest.fn();

jest.unstable_mockModule('../src/ai-agent/ai-agent-orchestrator.js', () => ({
  runAgent: runAgentMock,
}));

jest.unstable_mockModule('../evaluation/ai-system/faithfulness-judge.js', () => ({
  evaluateFaithfulness: evaluateFaithfulnessMock,
}));

const { runEvaluation } =
  await import('../evaluation/ai-system/evaluation-runner.js');

describe('evaluation runner', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    evaluateFaithfulnessMock.mockResolvedValue(true);
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
});
