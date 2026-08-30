import { embedQuery } from '../embeddings/embedding-client.js';
import { searchSimilarChunks } from '../embeddings/vector-storage.js';
import { routeInjuries } from './injury-router.js';

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
    return searchSimilarChunks(
      result.embedding,
      injuryId,
      limit,
      undefined,
      userId,
      requestId,
      maxDistance,
    );
  }

  // No injury was picked (e.g. no dropdown selection). Pooling every
  // injury's chunks into one top-k pulls in clearly-unrelated injuries
  // (#209) — route to the injury/injuries the question is actually about
  // first, then reuse the same scoped search used by the explicit-injuryId
  // path above, which is already known to retrieve correctly.
  const matchedInjuryIds = await routeInjuries(result.embedding, userId, requestId);

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
  const perInjuryLimit = Math.max(1, Math.ceil(limit / matchedInjuryIds.length));

  const perInjuryResults = await Promise.all(
    matchedInjuryIds.map((matchedInjuryId) =>
      searchSimilarChunks(
        result.embedding,
        matchedInjuryId,
        perInjuryLimit,
        undefined,
        userId,
        requestId,
        maxDistance,
      ),
    ),
  );

  return perInjuryResults
    .flat()
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}
