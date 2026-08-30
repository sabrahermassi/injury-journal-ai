import { searchSimilarChunks } from '../embeddings/vector-storage.js';
import {
  INJURY_MATCH_AMBIGUITY_MARGIN,
  MAX_MATCHED_INJURIES,
  INJURY_MATCH_FALLBACK_DISTANCE,
} from '../config/retrieval.js';

// A user's total injury count is always small (a personal journal, not a
// multi-tenant catalog), so this is effectively "all of this user's
// injuries" rather than a real top-k cutoff.
const INJURY_CANDIDATE_LIMIT = 50;

// Determines which injury (or injuries, if the match is ambiguous) an
// unscoped question is actually about, by comparing the question's
// embedding against each injury's own summary chunk (sourceType: 'injury')
// rather than the full pool of per-record chunks. See #209 and
// src/config/retrieval.ts for why.
export async function routeInjuries(
  embedding: number[],
  userId: number,
  requestId?: string,
): Promise<number[]> {
  const injuryChunks = await searchSimilarChunks(
    embedding,
    undefined,
    INJURY_CANDIDATE_LIMIT,
    'injury',
    userId,
    requestId,
  );

  if (injuryChunks.length === 0) {
    return [];
  }

  const bestDistance = injuryChunks[0].distance;

  // No injury is a clear match for this question (e.g. a broad "How am I
  // doing overall?" question, see #210) — searching only the near-tied
  // top few would silently drop injuries the question is arguably about
  // just as much as the ones that happened to be included. Search across
  // all of the user's injuries instead.
  if (bestDistance > INJURY_MATCH_FALLBACK_DISTANCE) {
    return injuryChunks.map((chunk) => chunk.injuryId);
  }

  const selected: number[] = [injuryChunks[0].injuryId];

  for (
    let i = 1;
    i < injuryChunks.length && selected.length < MAX_MATCHED_INJURIES;
    i++
  ) {
    if (injuryChunks[i].distance - bestDistance > INJURY_MATCH_AMBIGUITY_MARGIN) {
      break;
    }

    selected.push(injuryChunks[i].injuryId);
  }

  return selected;
}
