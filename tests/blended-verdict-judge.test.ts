import { jest } from '@jest/globals';

const generateAnswerMock = jest.fn();
const findManyMock = jest.fn();

jest.unstable_mockModule('../src/llm/llm-client.js', () => ({
  generateAnswer: generateAnswerMock,
}));

jest.unstable_mockModule('../src/lib/prisma.js', () => ({
  prisma: {
    injury: {
      findMany: findManyMock,
    },
  },
}));

const { evaluateBlendedVerdict } = await import(
  '../evaluation/ai-system/blended-verdict-judge.js'
);

describe('evaluateBlendedVerdict', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes without calling the LLM or DB when expectedBehavior is not answer_with_sources', async () => {
    const result = await evaluateBlendedVerdict('refuse', 'I cannot help with that.', [
      { injuryId: 1 },
      { injuryId: 4 },
    ]);

    expect(result).toBe(true);
    expect(findManyMock).not.toHaveBeenCalled();
    expect(generateAnswerMock).not.toHaveBeenCalled();
  });

  it('passes without calling the LLM or DB when chunks come from a single injury', async () => {
    const result = await evaluateBlendedVerdict('answer_with_sources', 'Improving overall.', [
      { injuryId: 1 },
      { injuryId: 1 },
    ]);

    expect(result).toBe(true);
    expect(findManyMock).not.toHaveBeenCalled();
    expect(generateAnswerMock).not.toHaveBeenCalled();
  });

  it('passes without calling the LLM when the injuries share the same status', async () => {
    findManyMock.mockResolvedValue([
      { name: 'Lower back pain', status: 'Active' },
      { name: 'Right shoulder pain', status: 'Active' },
    ]);

    const result = await evaluateBlendedVerdict('answer_with_sources', 'Both are ongoing.', [
      { injuryId: 1 },
      { injuryId: 2 },
    ]);

    expect(result).toBe(true);
    expect(generateAnswerMock).not.toHaveBeenCalled();
  });

  it('returns false when the judge replies BLENDED', async () => {
    findManyMock.mockResolvedValue([
      { name: 'Lower back pain', status: 'Active' },
      { name: 'Right knee pain', status: 'Resolved' },
    ]);
    generateAnswerMock.mockResolvedValue('BLENDED');

    const result = await evaluateBlendedVerdict('answer_with_sources', 'Overall, improving.', [
      { injuryId: 1 },
      { injuryId: 4 },
    ]);

    expect(result).toBe(false);
    expect(findManyMock).toHaveBeenCalledWith({
      where: { id: { in: [1, 4] } },
      select: { name: true, status: true },
    });
    expect(generateAnswerMock).toHaveBeenCalledTimes(1);
  });

  it('returns true when the judge replies DISTINCT', async () => {
    findManyMock.mockResolvedValue([
      { name: 'Lower back pain', status: 'Active' },
      { name: 'Right knee pain', status: 'Resolved' },
    ]);
    generateAnswerMock.mockResolvedValue('DISTINCT');

    const result = await evaluateBlendedVerdict(
      'answer_with_sources',
      'Your back is still active, but your knee has resolved.',
      [{ injuryId: 1 }, { injuryId: 4 }],
    );

    expect(result).toBe(true);
  });

  it('returns null when the judge reply is unparseable', async () => {
    findManyMock.mockResolvedValue([
      { name: 'Lower back pain', status: 'Active' },
      { name: 'Right knee pain', status: 'Resolved' },
    ]);
    generateAnswerMock.mockResolvedValue('');

    const result = await evaluateBlendedVerdict('answer_with_sources', 'Overall, improving.', [
      { injuryId: 1 },
      { injuryId: 4 },
    ]);

    expect(result).toBeNull();
  });
});
