import { jest } from '@jest/globals';

const embedQueryMock = jest.fn();
const searchSimilarChunksMock = jest.fn();

jest.unstable_mockModule('../src/embeddings/embedding-client.js', () => ({
  embedQuery: embedQueryMock,
}));

jest.unstable_mockModule('../src/embeddings/vector-storage.js', () => ({
  searchSimilarChunks: searchSimilarChunksMock,
}));

const { semanticSearch } = await import('../src/retrieval/semantic-search.js');

describe('semanticSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('embeds the query and searches using the resulting embedding', async () => {
    const embedding = [0.1, 0.2, 0.3];

    embedQueryMock.mockResolvedValue({
      embedding,
      model: 'test-model',
      modelVersion: 'v1',
      dimension: 3,
      version: 'test-version',
    });

    const chunks = [
      {
        id: 1,
        content: 'Lower back pain after sitting.',
        distance: 0.1,
      },
    ];

    searchSimilarChunksMock.mockResolvedValue(chunks);

    const result = await semanticSearch(
      'Why does my lower back hurt after sitting?',
    );

    expect(embedQueryMock).toHaveBeenCalledWith(
      'Why does my lower back hurt after sitting?',
      undefined,
    );

    expect(searchSimilarChunksMock).toHaveBeenCalledWith(
      embedding,
      undefined,
      5,
      undefined,
      undefined,
      undefined,
    );

    expect(result).toEqual(chunks);
  });

  it('passes a custom result limit to vector search', async () => {
    embedQueryMock.mockResolvedValue({
      embedding: [0.1, 0.2],
      model: 'test-model',
      modelVersion: 'v1',
      dimension: 2,
      version: 'test-version',
    });

    searchSimilarChunksMock.mockResolvedValue([]);

    await semanticSearch('lower back pain', undefined, 10);

    expect(searchSimilarChunksMock).toHaveBeenCalledWith(
      [0.1, 0.2],
      undefined,
      10,
      undefined,
      undefined,
      undefined,
    );
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

    await semanticSearch('lower back pain', 42, 5);

    expect(searchSimilarChunksMock).toHaveBeenCalledWith(
      [0.1, 0.2],
      42,
      5,
      undefined,
      undefined,
      undefined,
    );
  });

  it('propagates embedding errors', async () => {
    embedQueryMock.mockRejectedValue(new Error('embedding service unavailable'));

    await expect(semanticSearch('lower back pain')).rejects.toThrow(
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

    await expect(semanticSearch('lower back pain')).rejects.toThrow(
      'database unavailable',
    );
  });
});
