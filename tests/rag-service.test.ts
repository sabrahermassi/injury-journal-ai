import { jest } from '@jest/globals';

const semanticSearchMock = jest.fn();
const buildContextMock = jest.fn();
const buildPromptMock = jest.fn();
const generateAnswerMock = jest.fn();

jest.unstable_mockModule('../src/retrieval/semantic-search.js', () => ({
  semanticSearch: semanticSearchMock,
}));

jest.unstable_mockModule('../src/rag/context-builder.js', () => ({
  buildContext: buildContextMock,
}));

jest.unstable_mockModule('../src/rag/prompt-builder.js', () => ({
  buildPrompt: buildPromptMock,
}));

jest.unstable_mockModule('../src/llm/llm-client.js', () => ({
  generateAnswer: generateAnswerMock,
}));

const { answerQuestion } = await import('../src/rag/rag-service.js');

describe('rag service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retrieves context builds prompt and generates answer', async () => {
    const chunks = [
      {
        content: 'Shockwave therapy did not help.',
      },
    ];

    semanticSearchMock.mockResolvedValue(chunks);

    buildContextMock.mockReturnValue('Shockwave therapy did not help.');

    buildPromptMock.mockReturnValue('prompt');

    generateAnswerMock.mockResolvedValue('The treatment failed.');

    const result = await answerQuestion('What treatments failed?');

    expect(semanticSearchMock).toHaveBeenCalledWith(
      'What treatments failed?',
      5,
      undefined,
    );

    expect(buildContextMock).toHaveBeenCalledWith(chunks);

    expect(buildPromptMock).toHaveBeenCalledWith(
      'What treatments failed?',
      'Shockwave therapy did not help.',
    );

    expect(generateAnswerMock).toHaveBeenCalledWith('prompt');

    expect(result).toBe('The treatment failed.');
  });

  it('propagates retrieval errors', async () => {
    semanticSearchMock.mockRejectedValue(new Error('search failed'));

    await expect(answerQuestion('question')).rejects.toThrow('search failed');

    expect(generateAnswerMock).not.toHaveBeenCalled();
  });
});
