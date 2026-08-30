import { jest } from '@jest/globals';

const searchSimilarChunksMock = jest.fn();

jest.unstable_mockModule('../src/embeddings/vector-storage.js', () => ({
  searchSimilarChunks: searchSimilarChunksMock,
  MAX_COSINE_DISTANCE: 2,
}));

const { routeInjuries } = await import('../src/retrieval/injury-router.js');

// injury-router.ts bypasses the default distance cutoff by passing pgvector's
// max possible cosine distance explicitly — kept in sync with
// MAX_COSINE_DISTANCE in src/embeddings/vector-storage.ts.
const MAX_COSINE_DISTANCE = 2;

function injuryChunk(injuryId: number, distance: number) {
  return {
    id: injuryId,
    injuryId,
    userId: 1,
    sourceType: 'injury',
    sourceId: injuryId,
    chunkIndex: 0,
    content: `Injury summary ${injuryId}`,
    metadata: null,
    distance,
  };
}

describe('routeInjuries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('searches only sourceType:injury chunks for this user', async () => {
    searchSimilarChunksMock.mockResolvedValue([injuryChunk(1, 0.1)]);

    await routeInjuries([0.1, 0.2], 'test-model', 'v1', 7, 'req-1');

    expect(searchSimilarChunksMock).toHaveBeenCalledWith(
      [0.1, 0.2],
      'test-model',
      'v1',
      undefined,
      50,
      'injury',
      7,
      'req-1',
      MAX_COSINE_DISTANCE,
    );
  });

  it('returns just the best match when it clearly beats the rest', async () => {
    searchSimilarChunksMock.mockResolvedValue([
      injuryChunk(3, 0.46),
      injuryChunk(1, 0.68),
      injuryChunk(2, 0.69),
    ]);

    const result = await routeInjuries([0.1, 0.2], 'test-model', 'v1', 1);

    expect(result).toEqual([3]);
  });

  it('includes near-tied injuries within the ambiguity margin, up to the cap', async () => {
    searchSimilarChunksMock.mockResolvedValue([
      injuryChunk(1, 0.5),
      injuryChunk(2, 0.51),
      injuryChunk(3, 0.52),
      injuryChunk(4, 0.9),
    ]);

    const result = await routeInjuries([0.1, 0.2], 'test-model', 'v1', 1);

    expect(result).toEqual([1, 2, 3]);
  });

  it('returns an empty array when the user has no chunks at all', async () => {
    searchSimilarChunksMock.mockResolvedValue([]);

    const result = await routeInjuries([0.1, 0.2], 'test-model', 'v1', 1);

    expect(result).toEqual([]);
  });

  it('falls back to searching any sourceType when the user has chunks but no injury-summary chunk', async () => {
    searchSimilarChunksMock.mockImplementation(
      async (
        _embedding,
        _embeddingModel,
        _embeddingModelVersion,
        _injuryId,
        _limit,
        sourceType: string | undefined,
      ) => {
        if (sourceType === 'injury') {
          return [];
        }

        return [
          { id: 1, injuryId: 5, sourceType: 'treatment', sourceId: 1, distance: 0.2 },
          { id: 2, injuryId: 5, sourceType: 'symptom', sourceId: 2, distance: 0.3 },
        ];
      },
    );

    const result = await routeInjuries([0.1, 0.2], 'test-model', 'v1', 1);

    expect(searchSimilarChunksMock).toHaveBeenCalledTimes(2);
    expect(searchSimilarChunksMock).toHaveBeenNthCalledWith(
      2,
      [0.1, 0.2],
      'test-model',
      'v1',
      undefined,
      50,
      undefined,
      1,
      undefined,
      MAX_COSINE_DISTANCE,
    );
    expect(result).toEqual([5]);
  });

  it('falls back to every injury when nothing is a clear match (#210)', async () => {
    searchSimilarChunksMock.mockResolvedValue([
      injuryChunk(1, 0.8),
      injuryChunk(2, 0.85),
      injuryChunk(3, 0.9),
      injuryChunk(4, 0.95),
    ]);

    const result = await routeInjuries([0.1, 0.2], 'test-model', 'v1', 1);

    // Beyond MAX_MATCHED_INJURIES (3) and not near-tied — the fallback
    // should still return all 4, not silently drop the 4th.
    expect(result).toEqual([1, 2, 3, 4]);
  });
});
