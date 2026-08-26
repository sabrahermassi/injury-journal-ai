import { jest } from '@jest/globals';
import type { JournalDocument } from '../src/ingestion/documents/document-types.js';
import type { InjuryWithRelations } from '../src/ingestion/documents/document-builder.js';

/**
 * ingestion-worker.ts orchestrates the reader, the document builder, and
 * embedAndStoreDocument. We mock out all three collaborators so we can
 * assert on the worker's own sequencing/error-handling logic in isolation
 * -- in particular, that one document failing does not abort the run.
 */

const readJournalDataMock =
  jest.fn<() => Promise<InjuryWithRelations[]>>();

const buildJournalDocumentsMock =
  jest.fn<(injuries: InjuryWithRelations[]) => JournalDocument[]>();

const embedAndStoreDocumentMock =
  jest.fn<(document: JournalDocument) => Promise<void>>();

jest.unstable_mockModule('../src/ingestion/reader/postgres-reader.js', () => ({
  readJournalData: readJournalDataMock,
}));

jest.unstable_mockModule('../src/ingestion/documents/document-builder.js', () => ({
  buildJournalDocuments: buildJournalDocumentsMock,
}));

jest.unstable_mockModule('../src/ingestion/embed-and-store.js', () => ({
  embedAndStoreDocument: embedAndStoreDocumentMock,
}));

const { runIngestion } = await import('../src/ingestion/ingestion-worker.js');

function makeDocument(
  overrides: Partial<JournalDocument['metadata']> = {},
): JournalDocument {
  return {
    content: 'Document content.',
    metadata: {
      userId: 1,
      injuryId: 10,
      sourceType: 'treatment',
      sourceId: 100,
      date: new Date('2025-01-10'),
      ...overrides,
    },
  };
}

beforeEach(() => {
  readJournalDataMock.mockReset();
  buildJournalDocumentsMock.mockReset();
  embedAndStoreDocumentMock.mockReset();

  readJournalDataMock.mockResolvedValue([]);
  buildJournalDocumentsMock.mockReturnValue([]);
});

describe('runIngestion', () => {
  it('processes every document returned by the builder, in order', async () => {
    const documents = [
      makeDocument({ sourceType: 'symptom', sourceId: 1 }),
      makeDocument({ sourceType: 'treatment', sourceId: 2 }),
      makeDocument({ sourceType: 'medical_visit', sourceId: 3 }),
    ];

    readJournalDataMock.mockResolvedValue([{ id: 10 } as InjuryWithRelations]);
    buildJournalDocumentsMock.mockReturnValue(documents);
    embedAndStoreDocumentMock.mockResolvedValue(undefined);

    const result = await runIngestion();

    expect(embedAndStoreDocumentMock).toHaveBeenCalledTimes(3);
    expect(embedAndStoreDocumentMock).toHaveBeenNthCalledWith(1, documents[0]);
    expect(embedAndStoreDocumentMock).toHaveBeenNthCalledWith(2, documents[1]);
    expect(embedAndStoreDocumentMock).toHaveBeenNthCalledWith(3, documents[2]);

    expect(result).toEqual({ total: 3, succeeded: 3, failed: [] });
  });

  it('continues processing after a single document fails, and reports the failure', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const failing = makeDocument({
      sourceType: 'symptom',
      sourceId: 1,
      injuryId: 10,
    });
    const documents = [
      failing,
      makeDocument({ sourceType: 'treatment', sourceId: 2 }),
      makeDocument({ sourceType: 'medical_visit', sourceId: 3 }),
    ];

    buildJournalDocumentsMock.mockReturnValue(documents);
    const failure = new Error('embed-and-store failed');
    embedAndStoreDocumentMock
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    const result = await runIngestion();

    expect(embedAndStoreDocumentMock).toHaveBeenCalledTimes(3);
    expect(result.total).toBe(3);
    expect(result.succeeded).toBe(2);
    expect(result.failed).toEqual([
      {
        sourceType: 'symptom',
        sourceId: 1,
        injuryId: 10,
        error: failure,
      },
    ]);
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('returns an empty result when there is nothing to ingest', async () => {
    readJournalDataMock.mockResolvedValue([]);
    buildJournalDocumentsMock.mockReturnValue([]);

    const result = await runIngestion();

    expect(embedAndStoreDocumentMock).not.toHaveBeenCalled();
    expect(result).toEqual({ total: 0, succeeded: 0, failed: [] });
  });

  it('accumulates multiple failures without aborting the run', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const documents = [
      makeDocument({ sourceType: 'symptom', sourceId: 1 }),
      makeDocument({ sourceType: 'treatment', sourceId: 2 }),
      makeDocument({ sourceType: 'medical_visit', sourceId: 3 }),
    ];

    buildJournalDocumentsMock.mockReturnValue(documents);
    const firstFailure = new Error('first failure');
    const secondFailure = new Error('second failure');
    embedAndStoreDocumentMock
      .mockRejectedValueOnce(firstFailure)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(secondFailure);

    const result = await runIngestion();

    expect(embedAndStoreDocumentMock).toHaveBeenCalledTimes(3);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toHaveLength(2);
    expect(result.failed[0]).toMatchObject({ sourceId: 1, error: firstFailure });
    expect(result.failed[1]).toMatchObject({ sourceId: 3, error: secondFailure });

    consoleErrorSpy.mockRestore();
  });
});
