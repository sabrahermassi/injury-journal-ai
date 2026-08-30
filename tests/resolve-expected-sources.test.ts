import { jest } from '@jest/globals';

const prismaMock = {
  treatment: { findMany: jest.fn() },
  symptom: { findMany: jest.fn() },
  medicalVisit: { findMany: jest.fn() },
  injury: { findMany: jest.fn() },
};

jest.unstable_mockModule('../src/lib/prisma.js', () => ({
  prisma: prismaMock,
}));

const { resolveExpectedSources } = await import(
  '../evaluation/ai-system/resolve-expected-sources.js'
);

describe('resolveExpectedSources', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves a treatment by name scoped to its injury', async () => {
    prismaMock.treatment.findMany.mockResolvedValue([{ id: 2 }]);

    const result = await resolveExpectedSources(
      [{ sourceType: 'treatment', injuryId: 1, match: 'Shockwave therapy' }],
      1,
      'case-1',
    );

    expect(prismaMock.treatment.findMany).toHaveBeenCalledWith({
      where: { injuryId: 1, name: 'Shockwave therapy' },
      select: { id: true },
      take: 2,
    });
    expect(result).toEqual([{ sourceType: 'treatment', sourceId: 2 }]);
  });

  it('resolves a symptom by notes scoped to its injury', async () => {
    prismaMock.symptom.findMany.mockResolvedValue([{ id: 1 }]);

    const result = await resolveExpectedSources(
      [{ sourceType: 'symptom', injuryId: 1, match: 'Burning pain.' }],
      1,
      'case-2',
    );

    expect(prismaMock.symptom.findMany).toHaveBeenCalledWith({
      where: { injuryId: 1, notes: 'Burning pain.' },
      select: { id: true },
      take: 2,
    });
    expect(result).toEqual([{ sourceType: 'symptom', sourceId: 1 }]);
  });

  it('resolves a medical visit by doctor scoped to its injury', async () => {
    prismaMock.medicalVisit.findMany.mockResolvedValue([{ id: 1 }]);

    const result = await resolveExpectedSources(
      [{ sourceType: 'medical_visit', injuryId: 1, match: 'Dr. Smith' }],
      1,
      'case-3',
    );

    expect(prismaMock.medicalVisit.findMany).toHaveBeenCalledWith({
      where: { injuryId: 1, doctor: 'Dr. Smith' },
      select: { id: true },
      take: 2,
    });
    expect(result).toEqual([{ sourceType: 'medical_visit', sourceId: 1 }]);
  });

  it('resolves an injury by name scoped to the user', async () => {
    prismaMock.injury.findMany.mockResolvedValue([{ id: 1 }]);

    const result = await resolveExpectedSources(
      [{ sourceType: 'injury', match: 'Lower back pain' }],
      1,
      'case-4',
    );

    expect(prismaMock.injury.findMany).toHaveBeenCalledWith({
      where: { userId: 1, name: 'Lower back pain' },
      select: { id: true },
      take: 2,
    });
    expect(result).toEqual([{ sourceType: 'injury', sourceId: 1 }]);
  });

  it('throws a descriptive error when no record matches', async () => {
    prismaMock.treatment.findMany.mockResolvedValue([]);

    await expect(
      resolveExpectedSources(
        [{ sourceType: 'treatment', injuryId: 1, match: 'Nonexistent treatment' }],
        1,
        'case-missing',
      ),
    ).rejects.toThrow(
      'Eval case "case-missing": no treatment matching "Nonexistent treatment" found in injury 1. Check prisma/seed-dev.ts fixtures.',
    );
  });

  it('throws a descriptive error when more than one record matches', async () => {
    prismaMock.treatment.findMany.mockResolvedValue([{ id: 1 }, { id: 7 }]);

    await expect(
      resolveExpectedSources(
        [{ sourceType: 'treatment', injuryId: 1, match: 'Physiotherapy' }],
        1,
        'case-ambiguous',
      ),
    ).rejects.toThrow(
      'Eval case "case-ambiguous": more than one treatment matches "Physiotherapy" in injury 1 — the fixture description is no longer unique. Check prisma/seed-dev.ts fixtures.',
    );
  });

  it('returns an empty array for no fixtures', async () => {
    const result = await resolveExpectedSources([], 1, 'case-empty');

    expect(result).toEqual([]);
  });
});
