import { jest } from '@jest/globals';
import { Prisma } from '@prisma/client';

const findManyMock = jest.fn();

jest.unstable_mockModule('../src/lib/prisma.js', () => ({
  prisma: {
    injury: {
      findMany: findManyMock,
    },
  },
}));

const { listInjuries } = await import('../src/injuries/injuries-controller.js');

type MockRequest = {
  userId?: number;
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

const INJURIES = [
  { id: 7, name: 'Knee pain', bodyArea: 'knee', side: 'left' },
  { id: 3, name: 'Hip pain', bodyArea: 'hip', side: null },
];

describe('injuries controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the injuries for the authenticated user', async () => {
    findManyMock.mockResolvedValue(INJURIES as never);

    const req: MockRequest = { userId: 1 };
    const res = mockResponse();

    await listInjuries(req as never, res as never);

    expect(res.json).toHaveBeenCalledWith({ injuries: INJURIES });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('scopes the query to the authenticated user', async () => {
    findManyMock.mockResolvedValue([] as never);

    const req: MockRequest = { userId: 42 };

    await listInjuries(req as never, mockResponse() as never);

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 42 } }),
    );
  });

  it('never selects another user\'s injuries by omitting the filter', async () => {
    findManyMock.mockResolvedValue([] as never);

    await listInjuries({ userId: 5 } as never, mockResponse() as never);

    const [args] = findManyMock.mock.calls[0] as [{ where?: { userId?: number } }];

    expect(args.where).toBeDefined();
    expect(args.where?.userId).toBe(5);
  });

  it('returns an empty list when the user has no injuries', async () => {
    findManyMock.mockResolvedValue([] as never);

    const res = mockResponse();

    await listInjuries({ userId: 1 } as never, res as never);

    expect(res.json).toHaveBeenCalledWith({ injuries: [] });
  });

  it('returns 401 when the request has no authenticated user', async () => {
    const res = mockResponse();

    await listInjuries({} as never, res as never);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Authentication required',
      code: 'authentication_required',
    });
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it('maps a known Prisma error to database_error', async () => {
    findManyMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('boom', {
        code: 'P2021',
        clientVersion: 'test',
      }) as never,
    );

    const res = mockResponse();

    await listInjuries({ userId: 1 } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Failed to process request',
      code: 'database_error',
    });
  });

  it('maps an unexpected error to internal_error', async () => {
    findManyMock.mockRejectedValue(new Error('boom') as never);

    const res = mockResponse();

    await listInjuries({ userId: 1 } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Failed to process request',
      code: 'internal_error',
    });
  });
});
