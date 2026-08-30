import { jest } from '@jest/globals';
import type { JournalDocument } from '../src/ingestion/documents/document-types.js';

/**
 * embed-and-store.ts orchestrates chunking, embedding, and storage. We mock
 * out its collaborators (chunkDocument, embedText, storeDocumentChunk,
 * deleteDocumentChunksExcept) so we can assert on the orchestration logic in
 * isolation. `ingestion-lock.ts` is intentionally left un-mocked so we can
 * verify that ingestion is actually serialized per (sourceType, sourceId),
 * which is the behavior this PR introduces.
 */

const chunkDocumentMock =
  jest.fn<
    (
      document: JournalDocument,
    ) => ReturnType<
      typeof import('../src/ingestion/chunking/document-chunker.js').chunkDocument
    >
  >();

const embedTextMock = jest.fn<
  (text: string) => Promise<{
    embedding: number[];
    model: string;
    modelVersion: string;
    dimension: number;
    version: string;
  }>
>();

const storeDocumentChunkMock =
  jest.fn<
    (
      injuryId: number,
      userId: number,
      sourceType: string,
      sourceId: number,
      chunkIndex: number,
      content: string,
      embedding: number[],
      embeddingModel: string,
      embeddingModelVersion: string,
      metadata?: Record<string, unknown>,
    ) => Promise<void>
  >();

const deleteDocumentChunksExceptMock =
  jest.fn<
    (
      sourceType: string,
      sourceId: number,
      chunkIndexes: number[],
    ) => Promise<void>
  >();

jest.unstable_mockModule(
  '../src/ingestion/chunking/document-chunker.js',
  () => ({
    chunkDocument: chunkDocumentMock,
  }),
);

jest.unstable_mockModule('../src/embeddings/embedding-client.js', () => ({
  embedText: embedTextMock,
}));

jest.unstable_mockModule('../src/embeddings/vector-storage.js', () => ({
  storeDocumentChunk: storeDocumentChunkMock,
  deleteDocumentChunksExcept: deleteDocumentChunksExceptMock,
}));

const { embedAndStoreDocument } =
  await import('../src/ingestion/embed-and-store.js');

function makeDocument(
  overrides: Partial<JournalDocument['metadata']> = {},
): JournalDocument {
  return {
    content: 'Original document content.',
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

function fakeEmbedding(
  overrides: Partial<{
    embedding: number[];
    model: string;
    modelVersion: string;
    dimension: number;
    version: string;
  }> = {},
) {
  return {
    embedding: [0.1, 0.2],
    model: 'test-model',
    modelVersion: 'v1',
    dimension: 2,
    version: 'test-version',
    ...overrides,
  };
}

function createDeferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(() => {
  chunkDocumentMock.mockReset();
  embedTextMock.mockReset();
  storeDocumentChunkMock.mockReset();
  deleteDocumentChunksExceptMock.mockReset();

  storeDocumentChunkMock.mockResolvedValue(undefined);
  deleteDocumentChunksExceptMock.mockResolvedValue(undefined);
});

describe('embedAndStoreDocument', () => {
  it('chunks the document and embeds/stores every chunk', async () => {
    const document = makeDocument();
    const chunk1 = { content: 'chunk one', metadata: document.metadata };
    const chunk2 = { content: 'chunk two', metadata: document.metadata };

    chunkDocumentMock.mockReturnValue([chunk1, chunk2]);
    embedTextMock
      .mockResolvedValueOnce(fakeEmbedding({ embedding: [1, 1] }))
      .mockResolvedValueOnce(fakeEmbedding({ embedding: [2, 2] }));

    await embedAndStoreDocument(document);

    expect(chunkDocumentMock).toHaveBeenCalledWith(document, undefined);
    expect(embedTextMock).toHaveBeenCalledTimes(2);
    expect(embedTextMock).toHaveBeenNthCalledWith(1, 'chunk one');
    expect(embedTextMock).toHaveBeenNthCalledWith(2, 'chunk two');

    expect(storeDocumentChunkMock).toHaveBeenCalledTimes(2);
    expect(storeDocumentChunkMock).toHaveBeenNthCalledWith(
      1,
      document.metadata.injuryId,
      document.metadata.userId,
      document.metadata.sourceType,
      document.metadata.sourceId,
      0,
      'chunk one',
      [1, 1],
      'test-model',
      'v1',
      {
        ...document.metadata,
        embedding: {
          vectorDimension: 2,
          embeddingVersion: 'test-version',
        },
      },
    );
    expect(storeDocumentChunkMock).toHaveBeenNthCalledWith(
      2,
      document.metadata.injuryId,
      document.metadata.userId,
      document.metadata.sourceType,
      document.metadata.sourceId,
      1,
      'chunk two',
      [2, 2],
      'test-model',
      'v1',
      {
        ...document.metadata,
        embedding: {
          vectorDimension: 2,
          embeddingVersion: 'test-version',
        },
      },
    );
  });

  it('deletes stale chunks after storing, keyed by the produced chunk indexes', async () => {
    const document = makeDocument();
    const chunks = [
      { content: 'a', metadata: document.metadata },
      { content: 'b', metadata: document.metadata },
      { content: 'c', metadata: document.metadata },
    ];

    chunkDocumentMock.mockReturnValue(chunks);
    embedTextMock.mockResolvedValue(fakeEmbedding());

    await embedAndStoreDocument(document);

    expect(deleteDocumentChunksExceptMock).toHaveBeenCalledTimes(1);
    expect(deleteDocumentChunksExceptMock).toHaveBeenCalledWith(
      document.metadata.sourceType,
      document.metadata.sourceId,
      [0, 1, 2],
    );

    // Delete must happen after every chunk has been stored.
    const lastStoreOrder = storeDocumentChunkMock.mock.invocationCallOrder[2];
    const deleteOrder =
      deleteDocumentChunksExceptMock.mock.invocationCallOrder[0];
    expect(deleteOrder).toBeGreaterThan(lastStoreOrder);
  });

  it('handles documents that produce no chunks', async () => {
    const document = makeDocument();
    chunkDocumentMock.mockReturnValue([]);

    await embedAndStoreDocument(document);

    expect(embedTextMock).not.toHaveBeenCalled();
    expect(storeDocumentChunkMock).not.toHaveBeenCalled();
    expect(deleteDocumentChunksExceptMock).toHaveBeenCalledWith(
      document.metadata.sourceType,
      document.metadata.sourceId,
      [],
    );
  });

  it('propagates an embedding error and stops processing further chunks', async () => {
    const document = makeDocument();
    const chunk1 = { content: 'a', metadata: document.metadata };
    const chunk2 = { content: 'b', metadata: document.metadata };

    chunkDocumentMock.mockReturnValue([chunk1, chunk2]);
    embedTextMock.mockRejectedValueOnce(
      new Error('embedding service unavailable'),
    );

    await expect(embedAndStoreDocument(document)).rejects.toThrow(
      'embedding service unavailable',
    );

    expect(embedTextMock).toHaveBeenCalledTimes(1);
    expect(storeDocumentChunkMock).not.toHaveBeenCalled();
    expect(deleteDocumentChunksExceptMock).not.toHaveBeenCalled();
  });

  it('propagates a storage error without pruning stale chunks', async () => {
    const document = makeDocument();
    chunkDocumentMock.mockReturnValue([
      { content: 'a', metadata: document.metadata },
    ]);
    embedTextMock.mockResolvedValue(fakeEmbedding());
    storeDocumentChunkMock.mockRejectedValueOnce(new Error('db unavailable'));

    await expect(embedAndStoreDocument(document)).rejects.toThrow(
      'db unavailable',
    );

    expect(deleteDocumentChunksExceptMock).not.toHaveBeenCalled();
  });

  it('does not delete previously-stored chunks after a transient mid-document failure', async () => {
    const document = makeDocument();
    chunkDocumentMock.mockReturnValue([
      { content: 'a', metadata: document.metadata },
      { content: 'b', metadata: document.metadata },
      { content: 'c', metadata: document.metadata },
    ]);
    embedTextMock.mockResolvedValue(fakeEmbedding());
    storeDocumentChunkMock
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('transient db blip'));

    await expect(embedAndStoreDocument(document)).rejects.toThrow(
      'transient db blip',
    );

    // Chunks 0 and 1 were durably stored before the failure on chunk 2.
    // A failed run must not prune anything: the chunks it didn't reach
    // (e.g. a previously-stored chunk 2) may still be valid and are not
    // known to be stale just because this attempt didn't get to them.
    expect(deleteDocumentChunksExceptMock).not.toHaveBeenCalled();
  });

  it('serializes concurrent ingestion calls for the same sourceType/sourceId', async () => {
    const document = makeDocument({ sourceType: 'treatment', sourceId: 1 });
    const gate = createDeferred<void>();
    let chunkCallCount = 0;

    chunkDocumentMock.mockImplementation(() => {
      chunkCallCount += 1;
      return [{ content: 'chunk', metadata: document.metadata }];
    });

    embedTextMock.mockImplementation(async () => {
      if (chunkCallCount === 1) {
        await gate.promise;
      }
      return fakeEmbedding();
    });

    const p1 = embedAndStoreDocument(document);
    await Promise.resolve();
    await Promise.resolve();

    const p2 = embedAndStoreDocument(document);
    await Promise.resolve();
    await Promise.resolve();

    // p2's operation must not have started chunking yet, because the lock is
    // still held by p1's in-flight embed call.
    expect(chunkCallCount).toBe(1);

    gate.resolve();
    await Promise.all([p1, p2]);

    expect(chunkCallCount).toBe(2);
  });

  it('does not serialize ingestion calls for different sourceIds', async () => {
    const documentA = makeDocument({ sourceType: 'treatment', sourceId: 1 });
    const documentB = makeDocument({ sourceType: 'treatment', sourceId: 2 });
    const gate = createDeferred<void>();

    chunkDocumentMock.mockImplementation((doc: JournalDocument) => [
      { content: 'chunk', metadata: doc.metadata },
    ]);

    let callIndex = 0;
    embedTextMock.mockImplementation(async () => {
      callIndex += 1;
      if (callIndex === 1) {
        await gate.promise;
      }
      return fakeEmbedding();
    });

    const p1 = embedAndStoreDocument(documentA);
    await Promise.resolve();
    await Promise.resolve();

    const p2 = embedAndStoreDocument(documentB);

    // documentB uses a different lock key, so it should complete without
    // waiting on documentA's pending embed call.
    await p2;

    expect(chunkDocumentMock).toHaveBeenCalledTimes(2);

    gate.resolve();
    await p1;
  });
});
