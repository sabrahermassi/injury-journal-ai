import { jest } from '@jest/globals';

const embedQueryMock = jest.fn();
const searchSimilarChunksMock = jest.fn();
const routeInjuriesMock = jest.fn();

jest.unstable_mockModule('../src/embeddings/embedding-client.js', () => ({
  embedQuery: embedQueryMock,
}));

jest.unstable_mockModule('../src/embeddings/vector-storage.js', () => ({
  searchSimilarChunks: searchSimilarChunksMock,
}));

jest.unstable_mockModule('../src/retrieval/injury-router.js', () => ({
  routeInjuries: routeInjuriesMock,
}));

const { semanticSearch } = await import('../src/retrieval/semantic-search.js');

describe('semanticSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes an unscoped query to the matched injury and searches within it', async () => {
    const embedding = [0.1, 0.2, 0.3];

    embedQueryMock.mockResolvedValue({
      embedding,
      model: 'test-model',
      modelVersion: 'v1',
      dimension: 3,
      version: 'test-version',
    });

    routeInjuriesMock.mockResolvedValue([9]);

    const chunks = [
      {
        id: 1,
        injuryId: 9,
        content: 'Lower back pain after sitting.',
        distance: 0.1,
      },
    ];

    searchSimilarChunksMock.mockResolvedValue(chunks);

    const result = await semanticSearch(
      'Why does my lower back hurt after sitting?',
      undefined,
      1,
    );

    expect(embedQueryMock).toHaveBeenCalledWith(
      'Why does my lower back hurt after sitting?',
      undefined,
    );

    expect(routeInjuriesMock).toHaveBeenCalledWith(
      embedding,
      'test-model',
      'v1',
      1,
      undefined,
    );

    expect(searchSimilarChunksMock).toHaveBeenCalledWith(
      embedding,
      'test-model',
      'v1',
      9,
      10,
      undefined,
      1,
      undefined,
      undefined,
    );

    expect(result).toEqual(chunks);
  });

  it('merges, sorts, and truncates results when the question matches multiple injuries', async () => {
    embedQueryMock.mockResolvedValue({
      embedding: [0.1, 0.2],
      model: 'test-model',
      modelVersion: 'v1',
      dimension: 2,
      version: 'test-version',
    });

    routeInjuriesMock.mockResolvedValue([1, 2]);

    searchSimilarChunksMock.mockImplementation(async (
      _embedding,
      _embeddingModel,
      _embeddingModelVersion,
      matchedInjuryId: number,
    ) => {
      if (matchedInjuryId === 1) {
        return [
          { id: 10, injuryId: 1, distance: 0.5 },
          { id: 11, injuryId: 1, distance: 0.1 },
        ];
      }

      return [{ id: 20, injuryId: 2, distance: 0.3 }];
    });

    const result = await semanticSearch('a broad question', undefined, 1, 2);

    expect(result).toEqual([
      { id: 11, injuryId: 1, distance: 0.1 },
      { id: 20, injuryId: 2, distance: 0.3 },
    ]);
  });

  it('keeps an adjacent duplicate from the merged multi-injury result set without consuming a distinct slot (#215)', async () => {
    embedQueryMock.mockResolvedValue({
      embedding: [0.1, 0.2],
      model: 'test-model',
      modelVersion: 'v1',
      dimension: 2,
      version: 'test-version',
    });

    routeInjuriesMock.mockResolvedValue([1, 2]);

    searchSimilarChunksMock.mockImplementation(async (
      _embedding,
      _embeddingModel,
      _embeddingModelVersion,
      matchedInjuryId: number,
    ) => {
      if (matchedInjuryId === 1) {
        return [
          { id: 10, injuryId: 1, sourceType: 'journal', sourceId: 7, chunkIndex: 2, distance: 0.1 },
          { id: 11, injuryId: 1, sourceType: 'journal', sourceId: 7, chunkIndex: 3, distance: 0.15 },
        ];
      }

      return [{ id: 20, injuryId: 2, sourceType: 'journal', sourceId: 9, chunkIndex: 0, distance: 0.3 }];
    });

    const result = await semanticSearch('a broad question', undefined, 1, 2);

    // limit=2, but id 11 (adjacent to id 10) doesn't count toward it, so all
    // 3 chunks are returned — 2 distinct sources (id 10's and id 20's), with
    // id 11's content still included rather than dropped.
    expect(result).toEqual([
      { id: 10, injuryId: 1, sourceType: 'journal', sourceId: 7, chunkIndex: 2, distance: 0.1 },
      { id: 11, injuryId: 1, sourceType: 'journal', sourceId: 7, chunkIndex: 3, distance: 0.15 },
      { id: 20, injuryId: 2, sourceType: 'journal', sourceId: 9, chunkIndex: 0, distance: 0.3 },
    ]);
  });

  it('apportions the limit fairly across matched injuries so one cannot crowd out another', async () => {
    embedQueryMock.mockResolvedValue({
      embedding: [0.1, 0.2],
      model: 'test-model',
      modelVersion: 'v1',
      dimension: 2,
      version: 'test-version',
    });

    routeInjuriesMock.mockResolvedValue([1, 2, 3]);

    searchSimilarChunksMock.mockResolvedValue([]);

    await semanticSearch('a broad question', undefined, 1, 5);

    // limit=5 across 3 matched injuries: ceil(5/3) = 2 per injury, over-fetched x2 = 4.
    expect(searchSimilarChunksMock).toHaveBeenCalledTimes(3);
    expect(searchSimilarChunksMock).toHaveBeenCalledWith(
      [0.1, 0.2],
      'test-model',
      'v1',
      1,
      4,
      undefined,
      1,
      undefined,
      undefined,
    );
    expect(searchSimilarChunksMock).toHaveBeenCalledWith(
      [0.1, 0.2],
      'test-model',
      'v1',
      2,
      4,
      undefined,
      1,
      undefined,
      undefined,
    );
    expect(searchSimilarChunksMock).toHaveBeenCalledWith(
      [0.1, 0.2],
      'test-model',
      'v1',
      3,
      4,
      undefined,
      1,
      undefined,
      undefined,
    );
  });

  it('returns no chunks when the user has no matching injuries', async () => {
    embedQueryMock.mockResolvedValue({
      embedding: [0.1, 0.2],
      model: 'test-model',
      modelVersion: 'v1',
      dimension: 2,
      version: 'test-version',
    });

    routeInjuriesMock.mockResolvedValue([]);

    const result = await semanticSearch('lower back pain', undefined, 1);

    expect(result).toEqual([]);
    expect(searchSimilarChunksMock).not.toHaveBeenCalled();
  });

  it('passes injuryId to vector search when provided', async () => {
    embedQueryMock.mockResolvedValue({
      embedding: [0.1, 0.2],
      model: 'test-model',
      modelVersion: 'v1',
      dimension: 2,
      version: 'test-version',
    });

    searchSimilarChunksMock.mockResolvedValue([]);

    await semanticSearch('lower back pain', 42, 1, 5);

    expect(searchSimilarChunksMock).toHaveBeenCalledWith(
      [0.1, 0.2],
      'test-model',
      'v1',
      42,
      10,
      undefined,
      1,
      undefined,
      undefined,
    );
  });

  it('propagates embedding errors', async () => {
    embedQueryMock.mockRejectedValue(new Error('embedding service unavailable'));

    await expect(semanticSearch('lower back pain', undefined, 1)).rejects.toThrow(
      'embedding service unavailable',
    );

    expect(searchSimilarChunksMock).not.toHaveBeenCalled();
  });

  it('propagates vector search errors', async () => {
    embedQueryMock.mockResolvedValue({
      embedding: [0.1, 0.2],
      model: 'test-model',
      modelVersion: 'v1',
      dimension: 2,
      version: 'test-version',
    });

    searchSimilarChunksMock.mockRejectedValue(
      new Error('database unavailable'),
    );

    await expect(semanticSearch('lower back pain', 42, 1)).rejects.toThrow(
      'database unavailable',
    );
  });

  it('keeps an adjacent duplicate but does not let it consume a distinct slot (#215)', async () => {
    embedQueryMock.mockResolvedValue({
      embedding: [0.1, 0.2],
      model: 'test-model',
      modelVersion: 'v1',
      dimension: 2,
      version: 'test-version',
    });

    searchSimilarChunksMock.mockResolvedValue([
      { id: 1, sourceType: 'journal', sourceId: 7, chunkIndex: 2, distance: 0.05 },
      { id: 2, sourceType: 'journal', sourceId: 7, chunkIndex: 3, distance: 0.1 },
      { id: 3, sourceType: 'journal', sourceId: 7, chunkIndex: 8, distance: 0.2 },
    ]);

    const result = await semanticSearch('lower back pain', 42, 1, 5);

    // All 3 chunks are returned — id 2 is adjacent to id 1 and doesn't count
    // toward the limit, but its content is never dropped.
    expect(result).toEqual([
      { id: 1, sourceType: 'journal', sourceId: 7, chunkIndex: 2, distance: 0.05 },
      { id: 2, sourceType: 'journal', sourceId: 7, chunkIndex: 3, distance: 0.1 },
      { id: 3, sourceType: 'journal', sourceId: 7, chunkIndex: 8, distance: 0.2 },
    ]);
  });

  it('collapses a whole run of mutually-adjacent chunks into a single distinct slot (#215)', async () => {
    embedQueryMock.mockResolvedValue({
      embedding: [0.1, 0.2],
      model: 'test-model',
      modelVersion: 'v1',
      dimension: 2,
      version: 'test-version',
    });

    searchSimilarChunksMock.mockResolvedValue([
      { id: 1, sourceType: 'journal', sourceId: 7, chunkIndex: 2, distance: 0.05 },
      { id: 2, sourceType: 'journal', sourceId: 7, chunkIndex: 3, distance: 0.06 },
      { id: 3, sourceType: 'journal', sourceId: 7, chunkIndex: 4, distance: 0.07 },
      { id: 4, sourceType: 'journal', sourceId: 9, chunkIndex: 0, distance: 0.08 },
    ]);

    const result = await semanticSearch('lower back pain', 42, 1, 2);

    // ids 1-2-3 form one contiguous run (each adjacent to the next) and
    // together count as only 1 of the 2 requested slots — every chunk in
    // the run is still returned. id 4 (a different source) fills the 2nd
    // distinct slot, so all 4 chunks come back even though limit=2.
    expect(result).toEqual([
      { id: 1, sourceType: 'journal', sourceId: 7, chunkIndex: 2, distance: 0.05 },
      { id: 2, sourceType: 'journal', sourceId: 7, chunkIndex: 3, distance: 0.06 },
      { id: 3, sourceType: 'journal', sourceId: 7, chunkIndex: 4, distance: 0.07 },
      { id: 4, sourceType: 'journal', sourceId: 9, chunkIndex: 0, distance: 0.08 },
    ]);
  });

  it('retains a late-ranked adjacent chunk even after the distinct-slot target is reached (#231 review)', async () => {
    embedQueryMock.mockResolvedValue({
      embedding: [0.1, 0.2],
      model: 'test-model',
      modelVersion: 'v1',
      dimension: 2,
      version: 'test-version',
    });

    searchSimilarChunksMock.mockResolvedValue([
      { id: 1, sourceType: 'journal', sourceId: 7, chunkIndex: 2, distance: 0.1 },
      { id: 2, sourceType: 'journal', sourceId: 9, chunkIndex: 0, distance: 0.15 },
      { id: 3, sourceType: 'journal', sourceId: 7, chunkIndex: 3, distance: 0.2 },
    ]);

    const result = await semanticSearch('lower back pain', 42, 1, 2);

    // limit=2 is reached by id 1 and id 2 (2 distinct sources). id 3 ranks
    // last but is adjacent to id 1 (same source, chunkIndex within 1) — it
    // must still be retained, not dropped just because the distinct target
    // was already met by earlier, unrelated chunks.
    expect(result).toEqual([
      { id: 1, sourceType: 'journal', sourceId: 7, chunkIndex: 2, distance: 0.1 },
      { id: 2, sourceType: 'journal', sourceId: 9, chunkIndex: 0, distance: 0.15 },
      { id: 3, sourceType: 'journal', sourceId: 7, chunkIndex: 3, distance: 0.2 },
    ]);
  });

  it('keeps non-adjacent chunks from the same source', async () => {
    embedQueryMock.mockResolvedValue({
      embedding: [0.1, 0.2],
      model: 'test-model',
      modelVersion: 'v1',
      dimension: 2,
      version: 'test-version',
    });

    searchSimilarChunksMock.mockResolvedValue([
      { id: 1, sourceType: 'journal', sourceId: 7, chunkIndex: 0, distance: 0.05 },
      { id: 2, sourceType: 'journal', sourceId: 7, chunkIndex: 5, distance: 0.1 },
    ]);

    const result = await semanticSearch('lower back pain', 42, 1, 5);

    expect(result).toEqual([
      { id: 1, sourceType: 'journal', sourceId: 7, chunkIndex: 0, distance: 0.05 },
      { id: 2, sourceType: 'journal', sourceId: 7, chunkIndex: 5, distance: 0.1 },
    ]);
  });

  it('can return more than limit chunks when an adjacent duplicate fills a distinct slot', async () => {
    embedQueryMock.mockResolvedValue({
      embedding: [0.1, 0.2],
      model: 'test-model',
      modelVersion: 'v1',
      dimension: 2,
      version: 'test-version',
    });

    searchSimilarChunksMock.mockResolvedValue([
      { id: 1, sourceType: 'journal', sourceId: 7, chunkIndex: 2, distance: 0.05 },
      { id: 2, sourceType: 'journal', sourceId: 7, chunkIndex: 3, distance: 0.06 },
      { id: 3, sourceType: 'journal', sourceId: 9, chunkIndex: 1, distance: 0.07 },
    ]);

    const result = await semanticSearch('lower back pain', 42, 1, 2);

    // limit=2, but id 2 (adjacent to id 1) doesn't count toward it, so a 3rd
    // (distinct) chunk is pulled in to reach 2 distinct sources — nothing
    // is ever dropped to stay at exactly `limit`.
    expect(result).toEqual([
      { id: 1, sourceType: 'journal', sourceId: 7, chunkIndex: 2, distance: 0.05 },
      { id: 2, sourceType: 'journal', sourceId: 7, chunkIndex: 3, distance: 0.06 },
      { id: 3, sourceType: 'journal', sourceId: 9, chunkIndex: 1, distance: 0.07 },
    ]);
  });

  it('propagates injury-routing errors for unscoped queries', async () => {
    embedQueryMock.mockResolvedValue({
      embedding: [0.1, 0.2],
      model: 'test-model',
      modelVersion: 'v1',
      dimension: 2,
      version: 'test-version',
    });

    routeInjuriesMock.mockRejectedValue(new Error('database unavailable'));

    await expect(semanticSearch('lower back pain', undefined, 1)).rejects.toThrow(
      'database unavailable',
    );
  });
});
