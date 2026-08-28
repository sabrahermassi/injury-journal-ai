import { jest } from '@jest/globals';
import dataset from '../evaluation/ai-system/dataset.json';

const runAgentMock = jest.fn();

jest.unstable_mockModule('../src/ai-agent/ai-agent-orchestrator.js', () => ({
  runAgent: runAgentMock,
}));

const { runEvaluation } =
  await import('../evaluation/ai-system/evaluation-runner.js');

describe('evaluation runner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
