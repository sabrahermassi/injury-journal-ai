import { readJournalData } from '../../src/ingestion/reader/postgres-reader.js';
import { prisma } from '../../src/lib/prisma.js';

describe('Postgres reader integration', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('reads injuries from PostgreSQL', async () => {
    const data = await readJournalData();

    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it('returns injuries with their related records', async () => {
    const data = await readJournalData();

    const injury = data[0];

    expect(injury).toHaveProperty('id');
    expect(injury).toHaveProperty('userId');
    expect(injury).toHaveProperty('name');
    expect(injury).toHaveProperty('bodyArea');

    expect(Array.isArray(injury.Symptom)).toBe(true);
    expect(Array.isArray(injury.Treatment)).toBe(true);
    expect(Array.isArray(injury.MedicalVisit)).toBe(true);
    expect(Array.isArray(injury.TimelineEvent)).toBe(true);
  });

  it('reads seeded injury data from PostgreSQL', async () => {
    const data = await readJournalData();

    const injury = data.find((item) => item.name === 'Lower back pain');

    expect(injury).toBeDefined();

    expect(injury).toMatchObject({
      id: 1,
      userId: 1,
      name: 'Lower back pain',
      bodyArea: 'Lower back',
    });
  });
});
