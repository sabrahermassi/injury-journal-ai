import { jest } from '@jest/globals';

const ragToolMock = jest.fn();

jest.unstable_mockModule('../src/ai-agent/tools/rag-tool.js', () => ({
  ragTool: ragToolMock,
}));

const { runAgent } = await import('../src/ai-agent/ai-agent-service.js');

describe('AI agent service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses RAG tool for user questions', async () => {
    ragToolMock.mockResolvedValue({
      answer: 'Shockwave therapy failed.',
      citations: [],
    });

    const result = await runAgent('What treatments failed?');

    expect(ragToolMock).toHaveBeenCalledWith(
      'What treatments failed?',
      undefined,
      5,
    );

    expect(result).toEqual({
      answer: 'Shockwave therapy failed.',
      citations: [],
    });
  });

  it('passes injury id to tools', async () => {
    ragToolMock.mockResolvedValue({
      answer: 'Summary',
      citations: [],
    });

    await runAgent('Summarize treatments', 42);

    expect(ragToolMock).toHaveBeenCalledWith('Summarize treatments', 42, 5);
  });
});
