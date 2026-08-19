import { jest } from '@jest/globals';

const runAgentMock = jest.fn();

jest.unstable_mockModule('../src/ai-agent/ai-agent-orchestrator.js', () => ({
  runAgent: runAgentMock,
}));

const { askAgent } = await import('../src/ai-agent/ai-agent-controller.js');

function mockResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  } as any;
}

describe('ai agent controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns agent result', async () => {
    const req = {
      body: {
        question: 'What treatments failed?',
      },
    } as any;

    const res = mockResponse();

    runAgentMock.mockResolvedValue({
      answer: 'Shockwave therapy did not help.',
      citations: [
        {
          sourceType: 'treatment',
          sourceId: 42,
          label: 'Treatment #42',
        },
      ],
    });

    await askAgent(req, res);

    expect(runAgentMock).toHaveBeenCalledWith(
      'What treatments failed?',
      undefined,
    );

    expect(res.json).toHaveBeenCalledWith({
      answer: 'Shockwave therapy did not help.',
      citations: [
        {
          sourceType: 'treatment',
          sourceId: 42,
          label: 'Treatment #42',
        },
      ],
    });
  });

  it('passes injuryId to the agent', async () => {
    const req = {
      body: {
        question: 'Summarize my injury',
        injuryId: 42,
      },
    } as any;

    const res = mockResponse();

    runAgentMock.mockResolvedValue({
      answer: 'Summary',
      citations: [],
    });

    await askAgent(req, res);

    expect(runAgentMock).toHaveBeenCalledWith('Summarize my injury', 42);
  });

  it('returns 400 without question', async () => {
    const req = {
      body: {},
    } as any;

    const res = mockResponse();

    await askAgent(req, res);

    expect(res.status).toHaveBeenCalledWith(400);

    expect(runAgentMock).not.toHaveBeenCalled();
  });

  it('returns 500 when agent fails', async () => {
    const req = {
      body: {
        question: 'test',
      },
    } as any;

    const res = mockResponse();

    runAgentMock.mockRejectedValue(new Error('agent failed'));

    await askAgent(req, res);

    expect(res.status).toHaveBeenCalledWith(500);

    expect(res.json).toHaveBeenCalledWith({
      error: 'Failed to process request',
    });
  });
});
