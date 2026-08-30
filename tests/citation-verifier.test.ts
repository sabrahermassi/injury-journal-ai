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
    symptom: {
      findFirst: findFirstMock,
    },
    timelineEvent: {
      findFirst: findFirstMock,
    },
    injury: {
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

  it('verifies a symptom citation', async () => {
    findFirstMock.mockResolvedValue({
      id: 7,
      injuryId: 1,
      painLevel: 5,
    });

    const result = await verifyCitations([
      {
        sourceType: 'symptom',
        sourceId: 7,
        injuryId: 1,
      },
    ]);

    expect(findFirstMock).toHaveBeenCalledWith({
      where: {
        id: 7,
        injuryId: 1,
      },
    });

    expect(result).toEqual([
      {
        sourceType: 'symptom',
        sourceId: 7,
        injuryId: 1,
        verified: true,
      },
    ]);
  });

  it('verifies a timeline_event citation', async () => {
    findFirstMock.mockResolvedValue({
      id: 3,
      injuryId: 1,
      description: 'Surgery scheduled',
    });

    const result = await verifyCitations([
      {
        sourceType: 'timeline_event',
        sourceId: 3,
        injuryId: 1,
      },
    ]);

    expect(findFirstMock).toHaveBeenCalledWith({
      where: {
        id: 3,
        injuryId: 1,
      },
    });

    expect(result).toEqual([
      {
        sourceType: 'timeline_event',
        sourceId: 3,
        injuryId: 1,
        verified: true,
      },
    ]);
  });

  it('verifies an injury citation where sourceId matches injuryId', async () => {
    findFirstMock.mockResolvedValue({
      id: 1,
      name: 'Sprained ankle',
    });

    const result = await verifyCitations([
      {
        sourceType: 'injury',
        sourceId: 1,
        injuryId: 1,
      },
    ]);

    expect(findFirstMock).toHaveBeenCalledWith({
      where: {
        id: 1,
      },
    });

    expect(result).toEqual([
      {
        sourceType: 'injury',
        sourceId: 1,
        injuryId: 1,
        verified: true,
      },
    ]);
  });

  it('rejects an injury citation where sourceId does not match injuryId', async () => {
    const result = await verifyCitations([
      {
        sourceType: 'injury',
        sourceId: 1,
        injuryId: 2,
      },
    ]);

    expect(findFirstMock).not.toHaveBeenCalled();

    expect(result).toEqual([
      {
        sourceType: 'injury',
        sourceId: 1,
        injuryId: 2,
        verified: false,
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
