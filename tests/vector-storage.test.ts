import { jest } from '@jest/globals';

/**
 * vector-storage.ts talks to Postgres/pgvector through
 * `prisma.$executeRaw(Prisma.sql\`...\`)`. Since @prisma/client is a
 * generated client (and pgvector isn't available in the unit test
 * environment), we replace the whole module with a lightweight fake that
 * records the tagged-template pieces it receives so we can assert on the
 * generated query values without touching a real database.
 */

type SqlResult = { strings: string[]; values: unknown[] };

const executeRawMock = jest.fn<(query: SqlResult) => Promise<unknown>>();
const disconnectMock = jest.fn<() => Promise<void>>();

const sqlMock = jest.fn(
  (strings: TemplateStringsArray, ...values: unknown[]): SqlResult => ({
    strings: Array.from(strings),
    values,
  }),
);

const joinMock = jest.fn((values: unknown[]) => ({ __join__: values }));

jest.unstable_mockModule('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $executeRaw: executeRawMock,
    $disconnect: disconnectMock,
  })),
  Prisma: {
    sql: sqlMock,
    join: joinMock,
  },
}));

const { storeDocumentChunk, deleteDocumentChunksExcept, disconnectVectorStorage } =
  await import('../src/embeddings/vector-storage.js');

beforeEach(() => {
  executeRawMock.mockClear();
  disconnectMock.mockClear();
  sqlMock.mockClear();
  joinMock.mockClear();
  executeRawMock.mockResolvedValue(undefined);
  disconnectMock.mockResolvedValue(undefined);
});

describe('storeDocumentChunk', () => {
  it('inserts a document chunk with the embedding formatted as a pgvector literal', async () => {
    await storeDocumentChunk(1, 'treatment', 2, 0, 'some content', [0.1, 0.2, 0.3]);

    expect(executeRawMock).toHaveBeenCalledTimes(1);

    const query = executeRawMock.mock.calls[0][0] as SqlResult;
    expect(query.values).toEqual([
      1,
      'treatment',
      2,
      0,
      'some content',
      '[0.1,0.2,0.3]',
      null,
    ]);
  });

  it('serializes metadata to JSON when provided', async () => {
    await storeDocumentChunk(1, 'treatment', 2, 0, 'content', [0.1], {
      foo: 'bar',
    });

    const query = executeRawMock.mock.calls[0][0] as SqlResult;
    expect(query.values[6]).toBe(JSON.stringify({ foo: 'bar' }));
  });

  it('uses null metadata when none is provided', async () => {
    await storeDocumentChunk(1, 'treatment', 2, 0, 'content', [0.1]);

    const query = executeRawMock.mock.calls[0][0] as SqlResult;
    expect(query.values[6]).toBeNull();
  });

  it('formats an empty embedding array as an empty vector literal', async () => {
    await storeDocumentChunk(1, 'treatment', 2, 0, 'content', []);

    const query = executeRawMock.mock.calls[0][0] as SqlResult;
    expect(query.values[5]).toBe('[]');
  });

  it('passes the chunkIndex and content through unchanged', async () => {
    await storeDocumentChunk(7, 'medical_visit', 3, 4, 'chunk body text', [1]);

    const query = executeRawMock.mock.calls[0][0] as SqlResult;
    expect(query.values[0]).toBe(7);
    expect(query.values[1]).toBe('medical_visit');
    expect(query.values[2]).toBe(3);
    expect(query.values[3]).toBe(4);
    expect(query.values[4]).toBe('chunk body text');
  });
});

describe('deleteDocumentChunksExcept', () => {
  it('deletes all chunks for a source when no chunk indexes are provided', async () => {
    await deleteDocumentChunksExcept('treatment', 5, []);

    expect(executeRawMock).toHaveBeenCalledTimes(1);
    expect(joinMock).not.toHaveBeenCalled();

    const query = executeRawMock.mock.calls[0][0] as SqlResult;
    expect(query.values).toEqual(['treatment', 5]);
  });

  it('deletes only chunks not present in the provided list of indexes', async () => {
    await deleteDocumentChunksExcept('treatment', 5, [0, 1, 2]);

    expect(joinMock).toHaveBeenCalledWith([0, 1, 2]);

    const query = executeRawMock.mock.calls[0][0] as SqlResult;
    expect(query.values).toEqual(['treatment', 5, { __join__: [0, 1, 2] }]);
  });

  it('scopes the delete to the given sourceType and sourceId', async () => {
    await deleteDocumentChunksExcept('symptom', 9, [0]);

    const query = executeRawMock.mock.calls[0][0] as SqlResult;
    expect(query.values[0]).toBe('symptom');
    expect(query.values[1]).toBe(9);
  });
});

describe('disconnectVectorStorage', () => {
  it('disconnects the underlying prisma client', async () => {
    await disconnectVectorStorage();

    expect(disconnectMock).toHaveBeenCalledTimes(1);
  });
});