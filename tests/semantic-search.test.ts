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

    expect(routeInjuriesMock).toHaveBeenCalledWith(embedding, 1, undefined);

    expect(searchSimilarChunksMock).toHaveBeenCalledWith(
      embedding,
      9,
      5,
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

    searchSimilarChunksMock.mockImplementation(async (_embedding, matchedInjuryId: number) => {
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

    // limit=5 across 3 matched injuries: ceil(5/3) = 2 per injury.
    expect(searchSimilarChunksMock).toHaveBeenCalledTimes(3);
    expect(searchSimilarChunksMock).toHaveBeenCalledWith(
      [0.1, 0.2],
      1,
      2,
      undefined,
      1,
      undefined,
      undefined,
    );
    expect(searchSimilarChunksMock).toHaveBeenCalledWith(
      [0.1, 0.2],
      2,
      2,
      undefined,
      1,
      undefined,
      undefined,
    );
    expect(searchSimilarChunksMock).toHaveBeenCalledWith(
      [0.1, 0.2],
      3,
      2,
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
      42,
      5,
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
