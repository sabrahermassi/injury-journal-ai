import { jest } from '@jest/globals';

const findFirstMock = jest.fn();

jest.unstable_mockModule('../src/lib/prisma.js', () => ({
  prisma: {
    treatment: {
      findFirst: findFirstMock,
    },
    medicalVisit: {
      findFirst: findFirstMock,
    },
  },
}));

const { verifyCitations } = await import('../src/rag/citation-verifier.js');

describe('citation verifier', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('verifies an existing treatment citation', async () => {
    findFirstMock.mockResolvedValue({
      id: 42,
      injuryId: 1,
      name: 'Physiotherapy',
    });

    const result = await verifyCitations([
      {
        sourceType: 'treatment',
        sourceId: 42,
        injuryId: 1,
      },
    ]);

    expect(findFirstMock).toHaveBeenCalledWith({
      where: {
        id: 42,
        injuryId: 1,
      },
    });

    expect(result).toEqual([
      {
        sourceType: 'treatment',
        sourceId: 42,
        injuryId: 1,
        verified: true,
      },
    ]);
  });

  it('marks a missing treatment citation as unverified', async () => {
    findFirstMock.mockResolvedValue(null);

    const result = await verifyCitations([
      {
        sourceType: 'treatment',
        sourceId: 99,
        injuryId: 1,
      },
    ]);

    expect(result).toEqual([
      {
        sourceType: 'treatment',
        sourceId: 99,
        injuryId: 1,
        verified: false,
      },
    ]);
  });

  it('does not verify a source belonging to another injury', async () => {
    findFirstMock.mockResolvedValue(null);

    const result = await verifyCitations([
      {
        sourceType: 'treatment',
        sourceId: 42,
        injuryId: 2,
      },
    ]);

    expect(findFirstMock).toHaveBeenCalledWith({
      where: {
        id: 42,
        injuryId: 2,
      },
    });

    expect(result[0].verified).toBe(false);
  });

  it('verifies a medical visit citation', async () => {
    findFirstMock.mockResolvedValue({
      id: 10,
      injuryId: 1,
      doctor: 'Dr Smith',
    });

    const result = await verifyCitations([
      {
        sourceType: 'medical_visit',
        sourceId: 10,
        injuryId: 1,
      },
    ]);

    expect(findFirstMock).toHaveBeenCalledWith({
      where: {
        id: 10,
        injuryId: 1,
      },
    });

    expect(result).toEqual([
      {
        sourceType: 'medical_visit',
        sourceId: 10,
        injuryId: 1,
        verified: true,
      },
    ]);
  });

  it('marks unsupported citation types as unverified', async () => {
    const result = await verifyCitations([
      {
        sourceType: 'unknown',
        sourceId: 1,
        injuryId: 1,
      },
    ]);

    expect(findFirstMock).not.toHaveBeenCalled();

    expect(result).toEqual([
      {
        sourceType: 'unknown',
        sourceId: 1,
        injuryId: 1,
        verified: false,
      },
    ]);
  });
});
