import { jest } from '@jest/globals';

const embedTextMock = jest.fn();
const searchSimilarChunksMock = jest.fn();

jest.unstable_mockModule('../src/embeddings/embedding-client.js', () => ({
  embedText: embedTextMock,
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

    embedTextMock.mockResolvedValue({
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

    expect(embedTextMock).toHaveBeenCalledWith(
      'Why does my lower back hurt after sitting?',
    );

    expect(searchSimilarChunksMock).toHaveBeenCalledWith(
      embedding,
      undefined,
      5,
    );

    expect(result).toEqual(chunks);
  });

  it('passes a custom result limit to vector search', async () => {
    embedTextMock.mockResolvedValue({
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
    );
  });

  it('passes injuryId to vector search when provided', async () => {
    embedTextMock.mockResolvedValue({
      embedding: [0.1, 0.2],
      model: 'test-model',
      modelVersion: 'v1',
      dimension: 2,
      version: 'test-version',
    });

    searchSimilarChunksMock.mockResolvedValue([]);

    await semanticSearch('lower back pain', 42, 5);

    expect(searchSimilarChunksMock).toHaveBeenCalledWith([0.1, 0.2], 42, 5);
  });

  it('propagates embedding errors', async () => {
    embedTextMock.mockRejectedValue(new Error('embedding service unavailable'));

    await expect(semanticSearch('lower back pain')).rejects.toThrow(
      'embedding service unavailable',
    );

    expect(searchSimilarChunksMock).not.toHaveBeenCalled();
  });

  it('propagates vector search errors', async () => {
    embedTextMock.mockResolvedValue({
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
