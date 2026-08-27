import { jest } from '@jest/globals';

const safetyToolMock = jest.fn();
const ragToolMock = jest.fn();
const journalToolMock = jest.fn();
const formatInjuryRecordMock = jest.fn();
const routeIntentMock = jest.fn();
const generateAnswerMock = jest.fn();

jest.unstable_mockModule('../src/ai-agent/tools/safety-tool.js', () => ({
  safetyTool: safetyToolMock,
}));

jest.unstable_mockModule('../src/ai-agent/tools/rag-tool.js', () => ({
  ragTool: ragToolMock,
}));

jest.unstable_mockModule('../src/ai-agent/tools/journal-tool.js', () => ({
  journalTool: journalToolMock,
  formatInjuryRecord: formatInjuryRecordMock,
}));

jest.unstable_mockModule('../src/ai-agent/ai-agent-intent-router.js', () => ({
  routeIntent: routeIntentMock,
}));

jest.unstable_mockModule('../src/llm/llm-client.js', () => ({
  generateAnswer: generateAnswerMock,
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

    expect(safetyToolMock).toHaveBeenCalledWith('Do I have cancer?', undefined);

    expect(ragToolMock).not.toHaveBeenCalled();
    expect(journalToolMock).not.toHaveBeenCalled();

    expect(result).toEqual({
      answer: 'I cannot diagnose medical conditions.',
      citations: [],
      metadata: {
        retrievedChunks: [],
      },
    });
  });

  it('uses RAG tool for treatment questions', async () => {
    safetyToolMock.mockReturnValue({
      allowed: true,
    });

    routeIntentMock.mockReturnValue('rag');

    ragToolMock.mockResolvedValue({
      answer: 'Shockwave therapy did not help.',
      citations: [
        {
          sourceId: 42,
        },
      ],
      chunks: [
        {
          sourceType: 'treatment',
          sourceId: 42,
        },
      ],
    });

    const result = await runAgent('What treatments failed?');

    expect(routeIntentMock).toHaveBeenCalledWith(
      'What treatments failed?',
      undefined,
    );

    expect(ragToolMock).toHaveBeenCalledWith(
      'What treatments failed?',
      undefined,
      5,
      undefined,
    );

    expect(journalToolMock).not.toHaveBeenCalled();

    expect(result).toEqual({
      answer: 'Shockwave therapy did not help.',
      citations: [
        {
          sourceId: 42,
        },
      ],
      metadata: {
        retrievedChunks: [
          {
            sourceType: 'treatment',
            sourceId: 42,
          },
        ],
      },
    });
  });

  it('uses journal tool for timeline questions', async () => {
    safetyToolMock.mockReturnValue({
      allowed: true,
    });

    routeIntentMock.mockReturnValue('journal');

    journalToolMock.mockResolvedValue({
      id: 42,
    });

    formatInjuryRecordMock.mockReturnValue('Injury:\nName: Sprained ankle');

    generateAnswerMock.mockResolvedValue(
      'Your sprained ankle injury started on record.',
    );

    const result = await runAgent('Show my injury timeline', 42);

    expect(routeIntentMock).toHaveBeenCalledWith(
      'Show my injury timeline',
      undefined,
    );

    expect(journalToolMock).toHaveBeenCalledWith(42, undefined);

    expect(formatInjuryRecordMock).toHaveBeenCalledWith(
      { id: 42 },
      undefined,
    );

    expect(generateAnswerMock).toHaveBeenCalled();

    expect(ragToolMock).not.toHaveBeenCalled();

    expect(result).toEqual({
      answer: 'Your sprained ankle injury started on record.',
      citations: [],
    });
  });

  it('returns a fallback message when the LLM returns an empty answer for journal questions', async () => {
    safetyToolMock.mockReturnValue({
      allowed: true,
    });

    routeIntentMock.mockReturnValue('journal');

    journalToolMock.mockResolvedValue({
      id: 42,
    });

    formatInjuryRecordMock.mockReturnValue('Injury:\nName: Sprained ankle');

    generateAnswerMock.mockResolvedValue('');

    const result = await runAgent('Show my injury timeline', 42);

    expect(generateAnswerMock).toHaveBeenCalled();

    expect(result).toEqual({
      answer:
        'Unable to generate a summary from your injury record right now.',
      citations: [],
    });
  });
});
