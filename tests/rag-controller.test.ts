import { jest } from '@jest/globals';

const answerQuestionMock = jest.fn();

jest.unstable_mockModule('../src/rag/rag-service.js', () => ({
  answerQuestion: answerQuestionMock,
}));

const { askQuestion } = await import('../src/rag/rag-controller.js');

function mockResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  } as any;
}

describe('rag controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns generated answer', async () => {
    const req = {
      body: {
        question: 'What treatments failed?',
      },
    } as any;

    const res = mockResponse();

    answerQuestionMock.mockResolvedValue('Shockwave therapy failed.');

    await askQuestion(req, res);

    expect(answerQuestionMock).toHaveBeenCalled();

    expect(res.json).toHaveBeenCalledWith({
      answer: 'Shockwave therapy failed.',
    });
  });

  it('returns 400 without question', async () => {
    const req = {
      body: {},
    } as any;

    const res = mockResponse();

    await askQuestion(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 500 when generation fails', async () => {
    const req = {
      body: {
        question: 'test',
      },
    } as any;

    const res = mockResponse();

    answerQuestionMock.mockRejectedValue(new Error('LLM failed'));

    await askQuestion(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
