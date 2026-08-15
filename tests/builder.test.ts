import { buildJournalDocuments } from '../src/ingestion/documents/document-builder';
import { journalData } from './fixtures/journal-data';
import { expectedJournalDocuments } from './fixtures/expected-journal-documents';
import { log } from 'node:console';

describe('Document builder', () => {
  it.only('builds the expected journal documents', () => {
    const documents = buildJournalDocuments(journalData);

    console.log(documents);

    expect(documents.length).toBeGreaterThan(0);
    expect(documents).toEqual(expectedJournalDocuments);
  });
});
