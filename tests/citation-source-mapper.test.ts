import { jest } from '@jest/globals';

const prismaMock = {
  treatment: {
    findUnique: jest.fn(),
  },
  medicalVisit: {
    findUnique: jest.fn(),
  },
};

jest.unstable_mockModule('../src/lib/prisma.js', () => ({
  prisma: prismaMock,
}));

const { mapCitationSources } =
  await import('../src/rag/citation-source-mapper.js');

describe('source mapper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps treatment citations to treatment details', async () => {
    prismaMock.treatment.findUnique.mockResolvedValue({
      id: 42,
      name: 'Physiotherapy',
      date: new Date('2026-06-15'),
    });

    const result = await mapCitationSources([
      {
        sourceType: 'treatment',
        sourceId: 42,
      },
    ]);

    expect(result).toEqual([
      {
        sourceId: 42,
        type: 'Treatment',
        title: 'Physiotherapy',
        date: new Date('2026-06-15'),
      },
    ]);
  });

  it('maps medical visits', async () => {
    prismaMock.medicalVisit.findUnique.mockResolvedValue({
      id: 8,
      doctor: 'Dr Smith',
      date: new Date('2026-06-20'),
    });

    const result = await mapCitationSources([
      {
        sourceType: 'medical_visit',
        sourceId: 8,
      },
    ]);

    expect(result[0]).toEqual({
      sourceId: 8,
      type: 'Medical Visit',
      title: 'Visit with Dr Smith',
      date: new Date('2026-06-20'),
    });
  });
});
