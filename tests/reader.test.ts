import { readJournalData } from '../src/ingestion/reader/postgres-reader';

describe('Postgres reader', () => {
  it('reads journal data', async () => {
    const data = await readJournalData();

    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it('returns injuries with related records', async () => {
    const data = await readJournalData();

    const injury = data[0];

    expect(injury).toHaveProperty('id');
    expect(injury).toHaveProperty('userId');
    expect(injury).toHaveProperty('name');
    expect(injury).toHaveProperty('bodyArea');

    expect(injury).toHaveProperty('Symptom');
    expect(injury).toHaveProperty('Treatment');
    expect(injury).toHaveProperty('MedicalVisit');
    expect(injury).toHaveProperty('TimelineEvent');
  });
});
