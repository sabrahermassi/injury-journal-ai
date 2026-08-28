import { jest } from '@jest/globals';

const findFirstMock = jest.fn();

jest.unstable_mockModule('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    injury: {
      findFirst: findFirstMock,
    },
  })),
}));

const { journalTool, formatInjuryRecord } = await import('../src/ai-agent/tools/journal-tool.js');

function baseInjury() {
  return {
    id: 1,
    name: 'Sprained ankle',
    bodyArea: 'ankle',
    side: null,
    startDate: new Date('2026-01-05'),
    cause: null,
    description: null,
    status: null,
    createdAt: new Date('2026-01-05'),
    userId: 1,
    Treatment: [],
    Symptom: [],
    TimelineEvent: [],
    MedicalVisit: [],
  };
}

describe('journalTool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queries the injury by id and userId with all relations included and returns the result', async () => {
    const injury = baseInjury();
    findFirstMock.mockResolvedValue(injury);

    const result = await journalTool(1, 1);

    expect(findFirstMock).toHaveBeenCalledWith({
      where: {
        id: 1,
        userId: 1,
      },
      include: {
        Treatment: true,
        Symptom: true,
        TimelineEvent: true,
        MedicalVisit: true,
      },
    });
    expect(result).toBe(injury);
  });

  it('returns null when no injury is found', async () => {
    findFirstMock.mockResolvedValue(null);

    const result = await journalTool(999, 1);

    expect(result).toBeNull();
  });

  it('returns null when the injury exists but belongs to a different user', async () => {
    findFirstMock.mockResolvedValue(null);

    const result = await journalTool(1, 2);

    expect(findFirstMock).toHaveBeenCalledWith({
      where: {
        id: 1,
        userId: 2,
      },
      include: {
        Treatment: true,
        Symptom: true,
        TimelineEvent: true,
        MedicalVisit: true,
      },
    });
    expect(result).toBeNull();
  });
});

describe('formatInjuryRecord', () => {
  it('formats a minimal record with no optional fields or relations', () => {
    const result = formatInjuryRecord(baseInjury());

    expect(result).toBe(
      'Injury:\nName: Sprained ankle\nBody area: ankle\nStart date: 2026-01-05',
    );
  });

  it('includes optional injury fields and the side annotation when present', () => {
    const injury = {
      ...baseInjury(),
      side: 'left',
      cause: 'Fell while running',
      status: 'Recovering',
      description: 'Rolled ankle on uneven pavement',
    };

    const result = formatInjuryRecord(injury);

    expect(result).toBe(
      [
        'Injury:',
        'Name: Sprained ankle',
        'Body area: ankle (left)',
        'Start date: 2026-01-05',
        'Cause: Fell while running',
        'Status: Recovering',
        'Description: Rolled ankle on uneven pavement',
      ].join('\n'),
    );
  });

  it('formats symptoms, treatments, timeline events, and medical visits when present', () => {
    const injury = {
      ...baseInjury(),
      Symptom: [
        {
          id: 1,
          date: new Date('2026-01-06'),
          painLevel: 6,
          location: 'ankle',
          trigger: null,
          duration: null,
          notes: 'Worse after walking',
          injuryId: 1,
        },
        {
          id: 2,
          date: new Date('2026-01-10'),
          painLevel: 3,
          location: null,
          trigger: null,
          duration: null,
          notes: null,
          injuryId: 1,
        },
      ],
      Treatment: [
        {
          id: 1,
          name: 'Physiotherapy',
          provider: 'Dr. Lee',
          date: new Date('2026-01-08'),
          cost: null,
          outcome: 'Improved mobility',
          injuryId: 1,
        },
      ],
      TimelineEvent: [
        {
          id: 1,
          type: 'follow-up',
          date: new Date('2026-01-12'),
          description: 'Reassessed range of motion',
          result: 'Cleared for light activity',
          injuryId: 1,
        },
      ],
      MedicalVisit: [
        {
          id: 1,
          doctor: 'Dr. Lee',
          clinic: 'Downtown Clinic',
          date: new Date('2026-01-07'),
          notes: 'X-ray clear',
          injuryId: 1,
        },
      ],
    };

    const result = formatInjuryRecord(injury);

    expect(result).toBe(
      [
        'Injury:\nName: Sprained ankle\nBody area: ankle\nStart date: 2026-01-05',
        'Symptoms:\n- 2026-01-06: pain level 6 at ankle — Worse after walking\n- 2026-01-10: pain level 3',
        'Treatments:\n- 2026-01-08: Physiotherapy (Dr. Lee) — outcome: Improved mobility',
        'Timeline events:\n- 2026-01-12: follow-up — Reassessed range of motion (Cleared for light activity)',
        'Medical visits:\n- 2026-01-07: Dr. Lee at Downtown Clinic — X-ray clear',
      ].join('\n\n'),
    );
  });
});
