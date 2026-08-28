import { jest } from '@jest/globals';

const runAgentMock = jest.fn();

jest.unstable_mockModule('../src/ai-agent/ai-agent-orchestrator.js', () => ({
  runAgent: runAgentMock,
}));

const { askAssistant } =
  await import('../src/ai-assistant/ai-assistant-api.js');

describe('AI Assistant API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates requests to the agent', async () => {
    runAgentMock.mockResolvedValue({
      answer: 'summary',
      citations: [],
    });

    const result = await askAssistant('Summarize my injury history', 1, 1);

    expect(runAgentMock).toHaveBeenCalledWith(
      'Summarize my injury history',
      1,
      1,
    );

    expect(result).toEqual({
      answer: 'summary',
      citations: [],
    });
  });
});
