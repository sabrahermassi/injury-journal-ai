import { jest } from '@jest/globals';

const safetyToolMock = jest.fn();
const ragToolMock = jest.fn();

jest.unstable_mockModule('../src/ai-agent/tools/safety-tool.js', () => ({
  safetyTool: safetyToolMock,
}));

jest.unstable_mockModule('../src/ai-agent/tools/rag-tool.js', () => ({
  ragTool: ragToolMock,
}));

const { runAgent } = await import('../src/ai-agent/ai-agent-orchestrator.js');

describe('agent orchestrator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks unsafe questions before using tools', async () => {
    safetyToolMock.mockReturnValue({
      allowed: false,
      message: 'I cannot diagnose medical conditions.',
    });

    const result = await runAgent('Do I have cancer?');

    expect(safetyToolMock).toHaveBeenCalledWith('Do I have cancer?');

    expect(ragToolMock).not.toHaveBeenCalled();

    expect(result).toEqual({
      answer: 'I cannot diagnose medical conditions.',
      citations: [],
    });
  });

  it('uses RAG tool for allowed questions', async () => {
    safetyToolMock.mockReturnValue({
      allowed: true,
    });

    ragToolMock.mockResolvedValue({
      answer: 'Shockwave therapy did not help.',
      citations: [
        {
          sourceId: 42,
        },
      ],
    });

    const result = await runAgent('What treatments failed?');

    expect(ragToolMock).toHaveBeenCalledWith('What treatments failed?');

    expect(result).toEqual({
      answer: 'Shockwave therapy did not help.',
      citations: [
        {
          sourceId: 42,
        },
      ],
    });
  });
});
