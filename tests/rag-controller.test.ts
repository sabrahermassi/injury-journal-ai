import { jest } from '@jest/globals';
import type { Request, Response } from 'express';

const answerQuestionMock = jest.fn();

jest.unstable_mockModule('../src/rag/rag-service.js', () => ({
  answerQuestion: answerQuestionMock,
}));

const { askQuestion } = await import('../src/rag/rag-controller.js');

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

describe('rag controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns generated answer with citations', async () => {
    const req = {
      body: {
        question: 'What treatments failed?',
      },
    };

    const res = mockResponse();

    answerQuestionMock.mockResolvedValue({
      answer: 'Shockwave therapy failed.',
      citations: [
        {
          sourceType: 'treatment',
          sourceId: 42,
          label: 'Treatment #42',
        },
      ],
    });

    await askQuestion(req as Request, res as Response);

    expect(answerQuestionMock).toHaveBeenCalledWith(
      'What treatments failed?',
      undefined,
    );

    expect(res.json).toHaveBeenCalledWith({
      answer: 'Shockwave therapy failed.',
      citations: [
        {
          sourceType: 'treatment',
          sourceId: 42,
          label: 'Treatment #42',
        },
      ],
    });
  });

  it('returns safe response for blocked questions', async () => {
    const req: MockRequest = {
      body: {
        question: 'Do I have cancer?',
      },
    };

    const res = mockResponse();

    answerQuestionMock.mockResolvedValue({
      answer: 'I cannot diagnose medical conditions.',
      chunks: [],
      citations: [],
    });

    await askQuestion(req, res);

    expect(answerQuestionMock).toHaveBeenCalledWith(
      'Do I have cancer?',
      undefined,
    );

    expect(res.json).toHaveBeenCalledWith({
      answer: 'I cannot diagnose medical conditions.',
      chunks: [],
      citations: [],
    });
  });

  it('passes injuryId to RAG service filtering', async () => {
    answerQuestionMock.mockResolvedValue({
      answer: 'Result',
      citations: [],
    });

    const req: MockRequest = {
      body: {
        question: 'What treatments failed?',
        injuryId: 42,
      },
    };

    const res = mockResponse();

    await askQuestion(req as Request, res as Response);

    expect(answerQuestionMock).toHaveBeenCalledWith(
      'What treatments failed?',
      42,
    );
  });

  it('returns 400 without question', async () => {
    const req: MockRequest = {
      body: {},
    };

    const res = mockResponse();

    await askQuestion(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when body is missing', async () => {
    const req: MockRequest = {};

    const res = mockResponse();

    await askQuestion(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(400);

    expect(answerQuestionMock).not.toHaveBeenCalled();
  });

  it('returns 400 when injuryId is invalid', async () => {
    const req: MockRequest = {
      body: {
        question: 'What treatments failed?',
        injuryId: '42',
      },
    };

    const res = mockResponse();

    await askQuestion(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(answerQuestionMock).not.toHaveBeenCalled();
  });

  it('returns 500 when generation fails', async () => {
    const req: MockRequest = {
      body: {
        question: 'test',
      },
    };

    const res = mockResponse();

    answerQuestionMock.mockRejectedValue(new Error('LLM failed'));

    await askQuestion(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns 400 when question is not a string', async () => {
    const req: MockRequest = {
      body: {
        question: 123,
      },
    };

    const res = mockResponse();

    await askQuestion(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(400);

    expect(answerQuestionMock).not.toHaveBeenCalled();
  });
});
