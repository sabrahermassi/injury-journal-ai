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
const queryRawMock = jest.fn<(query: SqlResult) => Promise<unknown>>();
const disconnectMock = jest.fn<() => Promise<void>>();

const sqlMock = jest.fn(
  (strings: TemplateStringsArray, ...values: unknown[]): SqlResult => ({
    strings: Array.from(strings),
    values,
  }),
);

const joinMock = jest.fn((values: unknown[], separator?: string) => ({
  __join__: values,
  __separator__: separator,
}));

const emptyMarker = { __empty__: true };

jest.unstable_mockModule('@prisma/client', () => ({
  Prisma: {
    sql: sqlMock,
    join: joinMock,
    empty: emptyMarker,
  },
}));

jest.unstable_mockModule('../src/lib/prisma.js', () => ({
  prisma: {
    $executeRaw: executeRawMock,
    $queryRaw: queryRawMock,
    $disconnect: disconnectMock,
  },
}));

const {
  storeDocumentChunk,
  deleteDocumentChunksExcept,
  searchSimilarChunks,
  disconnectVectorStorage,
  DEFAULT_DISTANCE_THRESHOLD,
} = await import('../src/embeddings/vector-storage.js');

beforeEach(() => {
  executeRawMock.mockClear();
  queryRawMock.mockClear();
  disconnectMock.mockClear();
  sqlMock.mockClear();
  joinMock.mockClear();
  executeRawMock.mockResolvedValue(undefined);
  queryRawMock.mockResolvedValue([]);
  disconnectMock.mockResolvedValue(undefined);
});

describe('storeDocumentChunk', () => {
  it('inserts a document chunk with the embedding formatted as a pgvector literal', async () => {
    await storeDocumentChunk(
      1,
      9,
      'treatment',
      2,
      0,
      'some content',
      [0.1, 0.2, 0.3],
      'test-model',
      'v1',
    );

    expect(executeRawMock).toHaveBeenCalledTimes(1);

    const query = executeRawMock.mock.calls[0][0] as SqlResult;
    expect(query.values).toEqual([
      1,
      9,
      'treatment',
      2,
      0,
      'some content',
      '[0.1,0.2,0.3]',
      'test-model',
      'v1',
      null,
    ]);
  });

  it('serializes metadata to JSON when provided', async () => {
    await storeDocumentChunk(1, 9, 'treatment', 2, 0, 'content', [0.1], 'test-model', 'v1', {
      foo: 'bar',
    });

    const query = executeRawMock.mock.calls[0][0] as SqlResult;
    expect(query.values[9]).toBe(JSON.stringify({ foo: 'bar' }));
  });

  it('uses null metadata when none is provided', async () => {
    await storeDocumentChunk(1, 9, 'treatment', 2, 0, 'content', [0.1], 'test-model', 'v1');

    const query = executeRawMock.mock.calls[0][0] as SqlResult;
    expect(query.values[9]).toBeNull();
  });

  it('formats an empty embedding array as an empty vector literal', async () => {
    await storeDocumentChunk(1, 9, 'treatment', 2, 0, 'content', [], 'test-model', 'v1');

    const query = executeRawMock.mock.calls[0][0] as SqlResult;
    expect(query.values[6]).toBe('[]');
  });

  it('passes the chunkIndex and content through unchanged', async () => {
    await storeDocumentChunk(
      7,
      9,
      'medical_visit',
      3,
      4,
      'chunk body text',
      [1],
      'test-model',
      'v1',
    );

    const query = executeRawMock.mock.calls[0][0] as SqlResult;
    expect(query.values[0]).toBe(7);
    expect(query.values[1]).toBe(9);
    expect(query.values[2]).toBe('medical_visit');
    expect(query.values[3]).toBe(3);
    expect(query.values[4]).toBe(4);
    expect(query.values[5]).toBe('chunk body text');
  });

  it('passes the userId through unchanged', async () => {
    await storeDocumentChunk(1, 42, 'treatment', 2, 0, 'content', [0.1], 'test-model', 'v1');

    const query = executeRawMock.mock.calls[0][0] as SqlResult;
    expect(query.values[1]).toBe(42);
  });

  it('passes the embeddingModel and embeddingModelVersion through unchanged', async () => {
    await storeDocumentChunk(
      1,
      9,
      'treatment',
      2,
      0,
      'content',
      [0.1],
      'Qwen/Qwen3-Embedding-0.6B',
      'abc123',
    );

    const query = executeRawMock.mock.calls[0][0] as SqlResult;
    expect(query.values[7]).toBe('Qwen/Qwen3-Embedding-0.6B');
    expect(query.values[8]).toBe('abc123');
  });

  it('uses the correct ON CONFLICT clause for upserting by (sourceType, sourceId, chunkIndex)', async () => {
    await storeDocumentChunk(
      1,
      9,
      'treatment',
      2,
      0,
      'some content',
      [0.1, 0.2, 0.3],
      'test-model',
      'v1',
    );

    const query = executeRawMock.mock.calls[0][0] as SqlResult;
    const sql = query.strings.join('');
    expect(sql).toContain('ON CONFLICT ("sourceType", "sourceId", "chunkIndex")');
    expect(sql).toContain('DO UPDATE SET');
    expect(sql).toContain('"injuryId" = EXCLUDED."injuryId"');
    expect(sql).toContain('"userId" = EXCLUDED."userId"');
    expect(sql).toContain('"content" = EXCLUDED."content"');
    expect(sql).toContain('"embedding" = EXCLUDED."embedding"');
    expect(sql).toContain('"embeddingModel" = EXCLUDED."embeddingModel"');
    expect(sql).toContain('"embeddingModelVersion" = EXCLUDED."embeddingModelVersion"');
    expect(sql).toContain('"metadata" = EXCLUDED."metadata"');
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

describe('searchSimilarChunks', () => {
  it('formats the embedding as a pgvector literal and passes limit through', async () => {
    await searchSimilarChunks([0.1, 0.2, 0.3], 'test-model', 'v1', undefined, 7);

    expect(queryRawMock).toHaveBeenCalledTimes(1);
    expect(joinMock).toHaveBeenCalledTimes(1);

    const query = queryRawMock.mock.calls[0][0] as SqlResult;
    expect(query.values[0]).toBe('[0.1,0.2,0.3]');
    expect(query.values[2]).toBe('[0.1,0.2,0.3]');
    expect(query.values[3]).toBe(7);
  });

  it('always applies a distance-threshold filter, defaulting to DEFAULT_DISTANCE_THRESHOLD', async () => {
    await searchSimilarChunks([1], 'test-model', 'v1');

    expect(joinMock).toHaveBeenCalledTimes(1);
    const [filters, separator] = joinMock.mock.calls[0] as [SqlResult[], string];
    expect(separator).toBe(' AND ');
    expect(filters).toHaveLength(3);
    expect(filters[0].values).toEqual(['[1]', DEFAULT_DISTANCE_THRESHOLD]);
    expect(filters[0].strings.join('')).toContain('"embedding" <=>');

    const query = queryRawMock.mock.calls[0][0] as SqlResult;
    expect(query.values[3]).toBe(5);
  });

  it('always filters by embeddingModel and embeddingModelVersion, so vectors from a different model are never compared', async () => {
    await searchSimilarChunks([1], 'Qwen/Qwen3-Embedding-0.6B', 'abc123');

    const [filters] = joinMock.mock.calls[0] as [SqlResult[], string];
    expect(filters[1].values).toEqual(['Qwen/Qwen3-Embedding-0.6B']);
    expect(filters[1].strings.join('')).toContain('"embeddingModel"');
    expect(filters[2].values).toEqual(['abc123']);
    expect(filters[2].strings.join('')).toContain('"embeddingModelVersion"');
  });

  it('uses the provided maxDistance instead of the default', async () => {
    await searchSimilarChunks(
      [1],
      'test-model',
      'v1',
      undefined,
      5,
      undefined,
      undefined,
      undefined,
      0.3,
    );

    const [filters] = joinMock.mock.calls[0] as [SqlResult[], string];
    expect(filters[0].values).toEqual(['[1]', 0.3]);
  });

  it('filters by injuryId in addition to the distance threshold when sourceType is omitted', async () => {
    await searchSimilarChunks([1], 'test-model', 'v1', 42);

    expect(joinMock).toHaveBeenCalledTimes(1);
    const [filters, separator] = joinMock.mock.calls[0] as [SqlResult[], string];
    expect(separator).toBe(' AND ');
    expect(filters).toHaveLength(4);
    expect(filters[3].values).toEqual([42]);
    expect(filters[3].strings.join('')).toContain('"injuryId"');
  });

  it('filters by sourceType in addition to the distance threshold when injuryId is omitted', async () => {
    await searchSimilarChunks([1], 'test-model', 'v1', undefined, 5, 'treatment');

    expect(joinMock).toHaveBeenCalledTimes(1);
    const [filters] = joinMock.mock.calls[0] as [SqlResult[], string];
    expect(filters).toHaveLength(4);
    expect(filters[3].values).toEqual(['treatment']);
    expect(filters[3].strings.join('')).toContain('"sourceType"');
  });

  it('filters by both injuryId and sourceType when both are provided', async () => {
    await searchSimilarChunks([1], 'test-model', 'v1', 42, 5, 'treatment');

    expect(joinMock).toHaveBeenCalledTimes(1);
    const [filters, separator] = joinMock.mock.calls[0] as [SqlResult[], string];
    expect(separator).toBe(' AND ');
    expect(filters).toHaveLength(5);
    expect(filters[3].values).toEqual([42]);
    expect(filters[3].strings.join('')).toContain('"injuryId"');
    expect(filters[4].values).toEqual(['treatment']);
    expect(filters[4].strings.join('')).toContain('"sourceType"');
  });

  it('filters by userId in addition to the distance threshold when injuryId and sourceType are omitted', async () => {
    await searchSimilarChunks([1], 'test-model', 'v1', undefined, 5, undefined, 42);

    expect(joinMock).toHaveBeenCalledTimes(1);
    const [filters] = joinMock.mock.calls[0] as [SqlResult[], string];
    expect(filters).toHaveLength(4);
    expect(filters[3].values).toEqual([42]);
    expect(filters[3].strings.join('')).toContain('"userId"');
  });

  it('filters by injuryId, sourceType, and userId together when all are provided', async () => {
    await searchSimilarChunks([1], 'test-model', 'v1', 42, 5, 'treatment', 7);

    expect(joinMock).toHaveBeenCalledTimes(1);
    const [filters, separator] = joinMock.mock.calls[0] as [SqlResult[], string];
    expect(separator).toBe(' AND ');
    expect(filters).toHaveLength(6);
    expect(filters[3].values).toEqual([42]);
    expect(filters[3].strings.join('')).toContain('"injuryId"');
    expect(filters[4].values).toEqual(['treatment']);
    expect(filters[4].strings.join('')).toContain('"sourceType"');
    expect(filters[5].values).toEqual([7]);
    expect(filters[5].strings.join('')).toContain('"userId"');
  });
});

describe('disconnectVectorStorage', () => {
  it('disconnects the underlying prisma client', async () => {
    await disconnectVectorStorage();

    expect(disconnectMock).toHaveBeenCalledTimes(1);
  });
});