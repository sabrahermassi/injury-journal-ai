import { jest } from '@jest/globals';

const createMock = jest.fn();

jest.unstable_mockModule('groq-sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: createMock,
      },
    },
  })),
}));

const { generateAnswer } = await import('../src/llm/llm-client.js');

describe('generateAnswer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('generates an answer from the LLM', async () => {
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: 'Shockwave therapy did not help.',
          },
        },
      ],
    });

    const result = await generateAnswer(
      'system prompt',
      'What treatments failed?',
    );

    expect(result).toBe('Shockwave therapy did not help.');

    expect(createMock).toHaveBeenCalled();
  });

  it('sends the system and user prompts as separate messages', async () => {
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: 'answer',
          },
        },
      ],
    });

    await generateAnswer('system prompt', 'user prompt');

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          { role: 'system', content: 'system prompt' },
          { role: 'user', content: 'user prompt' },
        ],
      }),
    );
  });

  it('propagates LLM errors', async () => {
    createMock.mockRejectedValue(new Error('LLM unavailable'));

    await expect(
      generateAnswer('system prompt', 'question'),
    ).rejects.toThrow('LLM unavailable');
  });

  it('throws on a response with no choices', async () => {
    createMock.mockResolvedValue({ choices: [] });

    await expect(
      generateAnswer('system prompt', 'question'),
    ).rejects.toThrow('LLM returned a malformed response');
  });

  it('throws on a choice with no message', async () => {
    createMock.mockResolvedValue({ choices: [{}] });

    await expect(
      generateAnswer('system prompt', 'question'),
    ).rejects.toThrow('LLM returned a malformed response');
  });

  it('throws instead of crashing when choices is missing entirely', async () => {
    createMock.mockResolvedValue({});

    await expect(
      generateAnswer('system prompt', 'question'),
    ).rejects.toThrow('LLM returned a malformed response');
  });

  it('throws on a choice with non-string content', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: 42 } }],
    });

    await expect(
      generateAnswer('system prompt', 'question'),
    ).rejects.toThrow('LLM returned a malformed response');
  });

  it('returns an empty string for a legitimately empty completion', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: '' } }],
    });

    const result = await generateAnswer('system prompt', 'question');

    expect(result).toBe('');
  });
});
