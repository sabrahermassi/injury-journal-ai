import { embedQuery } from '../embeddings/embedding-client.js';
import { searchSimilarChunks } from '../embeddings/vector-storage.js';
import { routeInjuries } from './injury-router.js';

// Adjacent chunks from the same source can share most of their text once
// chunk overlap is involved (#135) — over-fetch so an adjacent duplicate
// doesn't cost the query one of its `limit` distinct sources (#215).
const OVERFETCH_FACTOR = 2;

interface DedupableChunk {
  sourceType: string;
  sourceId: number;
  chunkIndex: number;
  distance: number;
}

// Never drops a chunk — healthcare journal content must not be silently
// discarded just because it sits next to a near-duplicate. Instead, an
// adjacent chunk (same source, chunkIndex within 1) is still returned but
// doesn't count toward `limit`, so the result can exceed `limit` rather
// than lose a distinct source to make room for a near-duplicate. This
// extends transitively: a whole run of mutually-adjacent chunks (e.g.
// chunkIndex 2, 3, 4 in sequence) collapses into a single distinct slot,
// however long the run is, and every chunk in it is still returned. In the
// worst case (the entire over-fetched pool forms one contiguous run), the
// result size is bounded by the pool size (`limit * OVERFETCH_FACTOR`),
// not by `limit` — see `semanticSearch`'s `limit` param below.
function capToDistinctLimit<T extends DedupableChunk>(chunks: T[], limit: number): T[] {
  const sorted = [...chunks].sort((a, b) => a.distance - b.distance);
  const kept: T[] = [];
  let distinctCount = 0;

  for (const chunk of sorted) {
    const isAdjacentToKept = kept.some(
      (keptChunk) =>
        keptChunk.sourceType === chunk.sourceType &&
        keptChunk.sourceId === chunk.sourceId &&
        Math.abs(keptChunk.chunkIndex - chunk.chunkIndex) <= 1,
    );

    // Adjacency is checked before the limit gate: a later-ranked chunk that's
    // adjacent to one already kept must never be dropped just because the
    // distinct-slot target was already reached by earlier, unrelated chunks
    // (#231 review) — only a genuinely new (non-adjacent) source is subject
    // to the limit.
    if (isAdjacentToKept) {
      kept.push(chunk);
    } else if (distinctCount < limit) {
      kept.push(chunk);
      distinctCount += 1;
    }
  }

  return kept;
}

// `limit` is a target number of *distinct* sources, not a hard cap on chunks
// returned — see `capToDistinctLimit`. A query with adjacent near-duplicate
// chunks can return more than `limit` chunks (bounded by `limit *
// OVERFETCH_FACTOR`), never fewer than what's genuinely available.
export async function semanticSearch(
  query: string,
  injuryId: number | undefined,
  userId: number,
  limit = 5,
  requestId?: string,
  maxDistance?: number,
) {
  const result = await embedQuery(query, requestId);

  if (injuryId !== undefined) {
    const chunks = await searchSimilarChunks(
      result.embedding,
      result.model,
      result.modelVersion,
      injuryId,
      limit * OVERFETCH_FACTOR,
      undefined,
      userId,
      requestId,
      maxDistance,
    );

    return capToDistinctLimit(chunks, limit);
  }

  // No injury was picked (e.g. no dropdown selection). Pooling every
  // injury's chunks into one top-k pulls in clearly-unrelated injuries
  // (#209) — route to the injury/injuries the question is actually about
  // first, then reuse the same scoped search used by the explicit-injuryId
  // path above, which is already known to retrieve correctly.
  const matchedInjuryIds = await routeInjuries(
    result.embedding,
    result.model,
    result.modelVersion,
    userId,
    requestId,
  );

  if (matchedInjuryIds.length === 0) {
    return [];
  }

  // Give every matched injury a fair shot at the final result instead of
  // querying each for the full `limit` and letting per-record distance
  // (already shown unreliable at cross-injury comparisons — see #209/D11)
  // decide how many slots each injury gets. Capping each injury's own
  // query at its fair share means no single injury can crowd out another
  // injury that was judged equally relevant by the (trustworthy)
  // injury-level routing step above.
  //
  // Caveat (#215): this apportions distinct *slots* fairly, not raw content
  // volume. If one injury's top results happen to form one long contiguous
  // chain (one slot, many chunks — see capToDistinctLimit above) while
  // another injury contributes only single, non-adjacent chunks, the first
  // injury can still supply disproportionately more of the actual prompt
  // content even though slot counts stay even.
  const perInjuryLimit = Math.max(1, Math.ceil(limit / matchedInjuryIds.length));

  const perInjuryResults = await Promise.all(
    matchedInjuryIds.map((matchedInjuryId) =>
      searchSimilarChunks(
        result.embedding,
        result.model,
        result.modelVersion,
        matchedInjuryId,
        perInjuryLimit * OVERFETCH_FACTOR,
        undefined,
        userId,
        requestId,
        maxDistance,
      ),
    ),
  );

  return capToDistinctLimit(perInjuryResults.flat(), limit);
}
