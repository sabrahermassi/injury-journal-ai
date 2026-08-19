import { jest } from '@jest/globals';

const safetyToolMock = jest.fn();
const ragToolMock = jest.fn();
const journalToolMock = jest.fn();
const routeIntentMock = jest.fn();

jest.unstable_mockModule('../src/ai-agent/tools/safety-tool.js', () => ({
  safetyTool: safetyToolMock,
}));

jest.unstable_mockModule('../src/ai-agent/tools/rag-tool.js', () => ({
  ragTool: ragToolMock,
}));

jest.unstable_mockModule('../src/ai-agent/tools/journal-tool.js', () => ({
  journalTool: journalToolMock,
}));

jest.unstable_mockModule('../src/ai-agent/ai-agent-intent-router.js', () => ({
  routeIntent: routeIntentMock,
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
    expect(journalToolMock).not.toHaveBeenCalled();

    expect(result).toEqual({
      answer: 'I cannot diagnose medical conditions.',
      citations: [],
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
    });

    const result = await runAgent('What treatments failed?');

    expect(routeIntentMock).toHaveBeenCalledWith('What treatments failed?');

    expect(ragToolMock).toHaveBeenCalledWith('What treatments failed?');

    expect(journalToolMock).not.toHaveBeenCalled();

    expect(result).toEqual({
      answer: 'Shockwave therapy did not help.',
      citations: [
        {
          sourceId: 42,
        },
      ],
    });
  });

  it('uses journal tool for timeline questions', async () => {
    safetyToolMock.mockReturnValue({
      allowed: true,
    });

    routeIntentMock.mockReturnValue('journal');

    journalToolMock.mockResolvedValue({
      answer: 'Your injury started in 2022.',
      citations: [],
    });

    const result = await runAgent('Show my injury timeline');

    expect(routeIntentMock).toHaveBeenCalledWith('Show my injury timeline');

    expect(journalToolMock).toHaveBeenCalledWith('Show my injury timeline');

    expect(ragToolMock).not.toHaveBeenCalled();

    expect(result).toEqual({
      answer: 'Your injury started in 2022.',
      citations: [],
    });
  });
});
