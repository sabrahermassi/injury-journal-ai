import { jest } from '@jest/globals';

const semanticSearchMock = jest.fn();
const buildContextMock = jest.fn();
const buildPromptMock = jest.fn();
const generateAnswerMock = jest.fn();
const buildCitationsMock = jest.fn();
const checkSafetyMock = jest.fn();

jest.unstable_mockModule('../src/rag/citation-builder.js', () => ({
  buildCitations: buildCitationsMock,
}));

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

jest.unstable_mockModule('../src/safety/safety-service.js', () => ({
  checkSafety: checkSafetyMock,
}));

const { answerQuestion } = await import('../src/rag/rag-service.js');

describe('rag service', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    checkSafetyMock.mockReturnValue({
      allowed: true,
    });
  });

  it('retrieves context builds prompt generates answer and builds citations', async () => {
    const chunks = [
      {
        id: 1,
        sourceType: 'treatment',
        sourceId: 42,
        content: 'Shockwave therapy did not help.',
      },
    ];

    const citations = [
      {
        sourceType: 'treatment',
        sourceId: 42,
        label: 'Treatment #42',
      },
    ];

    semanticSearchMock.mockResolvedValue(chunks);

    buildContextMock.mockReturnValue('Shockwave therapy did not help.');

    buildPromptMock.mockReturnValue('prompt');

    generateAnswerMock.mockResolvedValue('The treatment failed.');

    buildCitationsMock.mockReturnValue(citations);

    const result = await answerQuestion('What treatments failed?');

    expect(checkSafetyMock).toHaveBeenCalledWith(
      'What treatments failed?',
      undefined,
    );

    expect(semanticSearchMock).toHaveBeenCalledWith(
      'What treatments failed?',
      undefined,
      5,
      undefined,
    );

    expect(buildContextMock).toHaveBeenCalledWith(chunks, undefined);

    expect(buildPromptMock).toHaveBeenCalledWith(
      'What treatments failed?',
      'Shockwave therapy did not help.',
      undefined,
    );

    expect(generateAnswerMock).toHaveBeenCalledWith('prompt', undefined);

    expect(buildCitationsMock).toHaveBeenCalledWith(chunks, undefined);

    expect(result).toEqual({
      answer: 'The treatment failed.',
      citations,
      chunks,
    });
  });

  it('returns generated answer with citations', async () => {
    const chunks = [
      {
        id: 1,
        sourceType: 'treatment',
        sourceId: 42,
        content: 'Shockwave therapy did not help',
        distance: 0.1,
      },
    ];

    const citations = [
      {
        sourceType: 'treatment',
        sourceId: 42,
        label: 'Treatment #42',
      },
    ];

    semanticSearchMock.mockResolvedValue(chunks);

    generateAnswerMock.mockResolvedValue(
      'Shockwave therapy did not improve symptoms.',
    );

    buildCitationsMock.mockReturnValue(citations);

    const result = await answerQuestion('What treatments did not work?');

    expect(buildCitationsMock).toHaveBeenCalledWith(chunks, undefined);

    expect(result).toEqual({
      answer: 'Shockwave therapy did not improve symptoms.',
      citations,
      chunks,
    });
  });

  it('blocks unsafe diagnosis requests', async () => {
    checkSafetyMock.mockReturnValue({
      allowed: false,
      reason: 'diagnosis_request',
      message: 'I cannot diagnose medical conditions.',
    });

    const result = await answerQuestion('Do I have cancer?');

    expect(checkSafetyMock).toHaveBeenCalledWith('Do I have cancer?', undefined);

    expect(result).toEqual({
      answer: 'I cannot diagnose medical conditions.',
      chunks: [],
      citations: [],
    });

    expect(semanticSearchMock).not.toHaveBeenCalled();
    expect(generateAnswerMock).not.toHaveBeenCalled();
    expect(buildCitationsMock).not.toHaveBeenCalled();
  });

  it('still generates an answer when retrieval finds zero chunks', async () => {
    semanticSearchMock.mockResolvedValue([]);

    buildContextMock.mockReturnValue('');

    buildPromptMock.mockReturnValue('prompt with empty context');

    generateAnswerMock.mockResolvedValue(
      'I do not have enough information to answer that.',
    );

    buildCitationsMock.mockReturnValue([]);

    const result = await answerQuestion('What treatments have I tried?');

    expect(buildContextMock).toHaveBeenCalledWith([], undefined);

    expect(buildPromptMock).toHaveBeenCalledWith(
      'What treatments have I tried?',
      '',
      undefined,
    );

    expect(generateAnswerMock).toHaveBeenCalledWith(
      'prompt with empty context',
      undefined,
    );

    expect(buildCitationsMock).toHaveBeenCalledWith([], undefined);

    expect(result).toEqual({
      answer: 'I do not have enough information to answer that.',
      citations: [],
      chunks: [],
    });
  });

  it('propagates retrieval errors', async () => {
    semanticSearchMock.mockRejectedValue(new Error('search failed'));

    await expect(answerQuestion('question')).rejects.toThrow('search failed');

    expect(generateAnswerMock).not.toHaveBeenCalled();
    expect(buildCitationsMock).not.toHaveBeenCalled();
  });
});
