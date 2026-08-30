import { jest } from '@jest/globals';

const searchSimilarChunksMock = jest.fn();

jest.unstable_mockModule('../src/embeddings/vector-storage.js', () => ({
  searchSimilarChunks: searchSimilarChunksMock,
}));

const { routeInjuries } = await import('../src/retrieval/injury-router.js');

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

    await routeInjuries([0.1, 0.2], 7, 'req-1');

    expect(searchSimilarChunksMock).toHaveBeenCalledWith(
      [0.1, 0.2],
      undefined,
      50,
      'injury',
      7,
      'req-1',
    );
  });

  it('returns just the best match when it clearly beats the rest', async () => {
    searchSimilarChunksMock.mockResolvedValue([
      injuryChunk(3, 0.46),
      injuryChunk(1, 0.68),
      injuryChunk(2, 0.69),
    ]);

    const result = await routeInjuries([0.1, 0.2], 1);

    expect(result).toEqual([3]);
  });

  it('includes near-tied injuries within the ambiguity margin, up to the cap', async () => {
    searchSimilarChunksMock.mockResolvedValue([
      injuryChunk(1, 0.5),
      injuryChunk(2, 0.51),
      injuryChunk(3, 0.52),
      injuryChunk(4, 0.9),
    ]);

    const result = await routeInjuries([0.1, 0.2], 1);

    expect(result).toEqual([1, 2, 3]);
  });

  it('returns an empty array when the user has no injuries', async () => {
    searchSimilarChunksMock.mockResolvedValue([]);

    const result = await routeInjuries([0.1, 0.2], 1);

    expect(result).toEqual([]);
  });

  it('falls back to every injury when nothing is a clear match (#210)', async () => {
    searchSimilarChunksMock.mockResolvedValue([
      injuryChunk(1, 0.8),
      injuryChunk(2, 0.85),
      injuryChunk(3, 0.9),
      injuryChunk(4, 0.95),
    ]);

    const result = await routeInjuries([0.1, 0.2], 1);

    // Beyond MAX_MATCHED_INJURIES (3) and not near-tied — the fallback
    // should still return all 4, not silently drop the 4th.
    expect(result).toEqual([1, 2, 3, 4]);
  });
});
