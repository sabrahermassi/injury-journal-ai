import { jest } from '@jest/globals';

const answerQuestionMock = jest.fn();

jest.unstable_mockModule('../src/rag/rag-service.js', () => ({
  answerQuestion: answerQuestionMock,
}));

const { ragTool } = await import('../src/ai-agent/tools/rag-tool.js');

describe('rag tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls RAG service with the user question', async () => {
    answerQuestionMock.mockResolvedValue({
      answer: 'Shockwave therapy did not help.',
      citations: [],
    });

    const result = await ragTool('What treatments failed?', undefined, 1);

    expect(answerQuestionMock).toHaveBeenCalledWith(
      'What treatments failed?',
      undefined,
      1,
      5,
      undefined,
    );

    expect(result).toEqual({
      answer: 'Shockwave therapy did not help.',
      citations: [],
    });
  });

  it('passes injury id to RAG service', async () => {
    answerQuestionMock.mockResolvedValue({
      answer: 'Treatment summary',
      citations: [],
    });

    await ragTool('Summarize treatments', 42, 1, 5);

    expect(answerQuestionMock).toHaveBeenCalledWith(
      'Summarize treatments',
      42,
      1,
      5,
      undefined,
    );
  });
});
