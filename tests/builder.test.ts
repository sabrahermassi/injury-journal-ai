import { buildJournalDocuments } from '../src/ingestion/documents/document-builder';
import { journalData } from './fixtures/journal-data';
import { expectedJournalDocuments } from './fixtures/expected-journal-documents';

describe('Document builder', () => {
  it('builds the expected journal documents', () => {
    const documents = buildJournalDocuments(journalData);

    expect(documents.length).toBeGreaterThan(0);
    expect(documents).toEqual(expectedJournalDocuments);
  });
});
