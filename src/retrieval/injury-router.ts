import { searchSimilarChunks, MAX_COSINE_DISTANCE } from '../embeddings/vector-storage.js';
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
  embeddingModel: string,
  embeddingModelVersion: string,
  userId: number,
  requestId?: string,
): Promise<number[]> {
  // Bypass the default distance cutoff here: this function's own distance
  // logic below (INJURY_MATCH_FALLBACK_DISTANCE / ambiguity margin) needs to
  // see every candidate's distance, including ones a generic threshold would
  // otherwise drop, to decide whether the question matches any injury at all.
  const injuryChunks = await searchSimilarChunks(
    embedding,
    embeddingModel,
    embeddingModelVersion,
    undefined,
    INJURY_CANDIDATE_LIMIT,
    'injury',
    userId,
    requestId,
    MAX_COSINE_DISTANCE,
  );

  if (injuryChunks.length === 0) {
    // This user has no sourceType:'injury' summary chunk to route on at
    // all — e.g. an injury summary specifically failed to ingest while its
    // other records succeeded (see the D11 known-limitation note), or a
    // caller stored chunks directly without going through the full
    // ingestion pipeline. Don't return nothing: fall back to searching
    // across whatever injuries the user does have chunks for, so an
    // unscoped question still finds real data instead of silently coming
    // up empty.
    const anyChunks = await searchSimilarChunks(
      embedding,
      embeddingModel,
      embeddingModelVersion,
      undefined,
      INJURY_CANDIDATE_LIMIT,
      undefined,
      userId,
      requestId,
      MAX_COSINE_DISTANCE,
    );

    return [...new Set(anyChunks.map((chunk) => chunk.injuryId))];
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
