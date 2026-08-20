import { jest } from '@jest/globals';

const runAgentMock = jest.fn();

jest.unstable_mockModule('../src/ai-agent/ai-agent-orchestrator.js', () => ({
  runAgent: runAgentMock,
}));

const { askAgent } = await import('../src/ai-agent/ai-agent-controller.js');

type MockRequest = {
  body?: {
    question?: unknown;
    injuryId?: unknown;
  };
};
type MockResponse = {
  status: jest.Mock;
  json: jest.Mock;
};

function mockResponse(): MockResponse {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

describe('ai agent controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns agent result', async () => {
    const req: MockRequest = {
      body: {
        question: 'What treatments failed?',
      },
    };

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
    const req: MockRequest = {
      body: {
        question: 'Summarize my injury',
        injuryId: 42,
      },
    };

    const res = mockResponse();

    runAgentMock.mockResolvedValue({
      answer: 'Summary',
      citations: [],
    });

    await askAgent(req, res);

    expect(runAgentMock).toHaveBeenCalledWith('Summarize my injury', 42);
  });

  it('returns 400 without question', async () => {
    const req: MockRequest = {
      body: {},
    };

    const res = mockResponse();

    await askAgent(req, res);

    expect(res.status).toHaveBeenCalledWith(400);

    expect(runAgentMock).not.toHaveBeenCalled();
  });

  it('returns 400 when injuryId is not a number', async () => {
    const req: MockRequest = {
      body: {
        question: 'Show my injury timeline',
        injuryId: '42',
      },
    };

    const res = mockResponse();

    await askAgent(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid injuryId',
    });
  });

  it('returns 400 when injuryId is not a positive integer', async () => {
    const req: MockRequest = {
      body: {
        question: 'Show my injury timeline',
        injuryId: 42.5,
      },
    };

    const res = mockResponse();

    await askAgent(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 500 when agent fails', async () => {
    const req: MockRequest = {
      body: {
        question: 'test',
      },
    };

    const res = mockResponse();

    runAgentMock.mockRejectedValue(new Error('agent failed'));

    await askAgent(req, res);

    expect(res.status).toHaveBeenCalledWith(500);

    expect(res.json).toHaveBeenCalledWith({
      error: 'Failed to process request',
    });
  });
});
