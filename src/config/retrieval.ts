// Used by injury-router.ts to decide which injuries a question without an
// explicit injuryId is actually about. Each injury has exactly one
// sourceType:'injury' summary chunk (document-builder.ts); comparing the
// question's embedding against just those chunks separates injuries far
// more reliably than pooling every record across every injury (see #209).
//
// Empirically (against the seeded dev dataset's 3 distinct injuries), the
// correct injury's summary chunk was always the closest match, with the
// smallest observed gap to the next-closest injury being ~0.07 cosine
// distance. The margin below is set comfortably under that so a clear
// single-injury match doesn't accidentally pull in a second injury, while
// still being loose enough to catch genuinely ambiguous/multi-injury
// questions (near-tied distances).
function parseNumberEnv(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined) {
    return fallback;
  }

  if (raw.trim() === '') {
    throw new Error(`Invalid ${name}: ${raw}`);
  }

  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid ${name}: ${raw}`);
  }

  return parsed;
}

const INJURY_MATCH_AMBIGUITY_MARGIN = parseNumberEnv(
  'INJURY_MATCH_AMBIGUITY_MARGIN',
  process.env.INJURY_MATCH_AMBIGUITY_MARGIN,
  0.03,
);

const MAX_MATCHED_INJURIES = parseNumberEnv(
  'MAX_MATCHED_INJURIES',
  process.env.MAX_MATCHED_INJURIES,
  3,
);

// A broad, non-injury-specific question (e.g. "How am I doing overall?")
// doesn't resemble any single injury's name/bodyArea/description, so its
// distance to every injury's summary chunk tends to be uniformly mediocre
// rather than dominated by one clear winner or a small near-tied group —
// the ambiguity margin above won't reliably catch this case (see #209/#210
// discussion). If even the *closest* injury summary doesn't beat this
// floor, treat the question as not being about any one injury in
// particular and fall back to searching across all of the user's injuries,
// rather than silently narrowing to an arbitrary subset.
//
// Measured directly against the seeded dev dataset's real user (userId 1,
// two injuries: lower back / knee) via the live embedding service — not a
// guess. Single-injury questions ("What treatments have I tried for my
// knee?", "Why does my knee hurt?", etc.) scored a best injury-summary
// distance of 0.32-0.56. Broad, non-injury-specific questions ("How am I
// doing overall?", "Summarize my recovery progress", "List all my
// treatments") scored 0.67-0.82. This default (0.62) sits in the gap
// between those two clusters. Only 2 injuries and a handful of questions
// were sampled, so this is a real-but-thin calibration, not an
// evaluation-validated cutoff — recalibrate if the evaluation dataset gains
// broad/multi-injury cases and this stops separating them correctly.
const INJURY_MATCH_FALLBACK_DISTANCE = parseNumberEnv(
  'INJURY_MATCH_FALLBACK_DISTANCE',
  process.env.INJURY_MATCH_FALLBACK_DISTANCE,
  0.62,
);

export {
  INJURY_MATCH_AMBIGUITY_MARGIN,
  MAX_MATCHED_INJURIES,
  INJURY_MATCH_FALLBACK_DISTANCE,
};
