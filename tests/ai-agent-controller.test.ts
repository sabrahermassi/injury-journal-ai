import { jest } from '@jest/globals';

const runAgentMock = jest.fn();

jest.unstable_mockModule('../src/ai-agent/ai-agent-orchestrator.js', () => ({
  runAgent: runAgentMock,
}));

const { askAgent } = await import('../src/ai-agent/ai-agent-controller.js');

type MockRequest = {
  headers?: Record<string, string>;
  userId?: number;
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
      userId: 1,
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
      1,
      undefined,
      expect.any(String),
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

  it('uses a supplied x-request-id header instead of generating one', async () => {
    const req: MockRequest = {
      userId: 1,
      headers: {
        'x-request-id': 'client-supplied-id',
      },
      body: {
        question: 'What treatments failed?',
      },
    };

    const res = mockResponse();

    runAgentMock.mockResolvedValue({
      answer: 'Shockwave therapy did not help.',
      citations: [],
    });

    await askAgent(req, res);

    expect(runAgentMock).toHaveBeenCalledWith(
      'What treatments failed?',
      1,
      undefined,
      'client-supplied-id',
    );
  });

  it('generates a request ID when the x-request-id header is empty', async () => {
    const req: MockRequest = {
      userId: 1,
      headers: {
        'x-request-id': '',
      },
      body: {
        question: 'What treatments failed?',
      },
    };

    const res = mockResponse();

    runAgentMock.mockResolvedValue({
      answer: 'Shockwave therapy did not help.',
      citations: [],
    });

    await askAgent(req, res);

    expect(runAgentMock).toHaveBeenCalledWith(
      'What treatments failed?',
      1,
      undefined,
      expect.not.stringMatching(/^$/),
    );
  });

  it('passes injuryId to the agent', async () => {
    const req: MockRequest = {
      userId: 1,
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

    expect(runAgentMock).toHaveBeenCalledWith(
      'Summarize my injury',
      1,
      42,
      expect.any(String),
    );
  });

  it('returns 401 when the authenticated userId is missing', async () => {
    const req: MockRequest = {
      body: {
        question: 'What treatments failed?',
      },
    };

    const res = mockResponse();

    await askAgent(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Authentication required',
      code: 'authentication_required',
    });

    expect(runAgentMock).not.toHaveBeenCalled();
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

  it('returns 400 when req.body is undefined', async () => {
    const req: MockRequest = {};

    const res = mockResponse();

    await askAgent(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Question is required',
      code: 'question_required',
    });

    expect(runAgentMock).not.toHaveBeenCalled();
  });

  it('returns 400 when question exceeds the maximum length', async () => {
    const req: MockRequest = {
      body: {
        question: 'x'.repeat(10_001),
      },
    };

    const res = mockResponse();

    await askAgent(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Question exceeds maximum length of 10000 characters',
      code: 'question_too_long',
    });

    expect(runAgentMock).not.toHaveBeenCalled();
  });

  it('accepts a question at exactly the maximum length', async () => {
    const req: MockRequest = {
      userId: 1,
      body: {
        question: 'x'.repeat(10_000),
      },
    };

    const res = mockResponse();

    runAgentMock.mockResolvedValue({
      answer: 'ok',
      citations: [],
    });

    await askAgent(req, res);

    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(runAgentMock).toHaveBeenCalled();
  });

  it('returns "Question is required" when the body is a non-object JSON value', async () => {
    const req = { body: 'not an object' } as unknown as MockRequest;

    const res = mockResponse();

    await askAgent(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Question is required',
      code: 'question_required',
    });

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
      code: 'invalid_injury_id',
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
      userId: 1,
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
      code: 'internal_error',
    });
  });
});
