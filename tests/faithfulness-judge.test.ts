import { jest } from '@jest/globals';

const generateAnswerMock = jest.fn();
const findManyMock = jest.fn();

jest.unstable_mockModule('../src/llm/llm-client.js', () => ({
  generateAnswer: generateAnswerMock,
}));

jest.unstable_mockModule('../src/lib/prisma.js', () => ({
  prisma: {
    documentChunk: {
      findMany: findManyMock,
    },
  },
}));

const { evaluateFaithfulness } = await import(
  '../evaluation/ai-system/faithfulness-judge.js'
);

describe('evaluateFaithfulness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes without calling the LLM or DB when expectedBehavior is not answer_with_sources', async () => {
    const result = await evaluateFaithfulness('refuse', 'I cannot help with that.', [
      { sourceType: 'treatment', sourceId: 42 },
    ]);

    expect(result).toBe(true);
    expect(findManyMock).not.toHaveBeenCalled();
    expect(generateAnswerMock).not.toHaveBeenCalled();
  });

  it('passes without calling the LLM or DB when no chunks were retrieved', async () => {
    const result = await evaluateFaithfulness(
      'answer_with_sources',
      'Shockwave therapy failed.',
      [],
    );

    expect(result).toBe(true);
    expect(findManyMock).not.toHaveBeenCalled();
    expect(generateAnswerMock).not.toHaveBeenCalled();
  });

  it('passes without calling the LLM when the DB has no matching chunk content', async () => {
    findManyMock.mockResolvedValue([]);

    const result = await evaluateFaithfulness(
      'answer_with_sources',
      'Shockwave therapy failed.',
      [{ sourceType: 'treatment', sourceId: 42 }],
    );

    expect(result).toBe(true);
    expect(generateAnswerMock).not.toHaveBeenCalled();
  });

  it('returns true when the judge replies FAITHFUL', async () => {
    findManyMock.mockResolvedValue([{ content: 'Shockwave therapy was discontinued.' }]);
    generateAnswerMock.mockResolvedValue('FAITHFUL');

    const result = await evaluateFaithfulness(
      'answer_with_sources',
      'Shockwave therapy failed.',
      [{ sourceType: 'treatment', sourceId: 42 }],
    );

    expect(result).toBe(true);
    expect(findManyMock).toHaveBeenCalledWith({
      where: { OR: [{ sourceType: 'treatment', sourceId: 42 }] },
      select: { content: true },
    });
    expect(generateAnswerMock).toHaveBeenCalledTimes(1);
  });

  it('returns false when the judge replies UNFAITHFUL', async () => {
    findManyMock.mockResolvedValue([{ content: 'Shockwave therapy was discontinued.' }]);
    generateAnswerMock.mockResolvedValue('UNFAITHFUL');

    const result = await evaluateFaithfulness(
      'answer_with_sources',
      'Shockwave therapy cured the injury completely.',
      [{ sourceType: 'treatment', sourceId: 42 }],
    );

    expect(result).toBe(false);
  });

  it('returns null when the judge reply is unparseable', async () => {
    findManyMock.mockResolvedValue([{ content: 'Shockwave therapy was discontinued.' }]);
    generateAnswerMock.mockResolvedValue('');

    const result = await evaluateFaithfulness(
      'answer_with_sources',
      'Shockwave therapy failed.',
      [{ sourceType: 'treatment', sourceId: 42 }],
    );

    expect(result).toBeNull();
  });
});
