import dataset from './dataset.json' with { type: 'json' };
import { runAgent } from '../../src/ai-agent/ai-agent-orchestrator.js';
import {
  evaluateSafety,
  evaluateCitations,
  evaluateNoInformation,
  evaluateIntent,
} from './evaluator-metrics.js';
import { evaluateRetrieval } from './retrieval-metrics.js';
import { evaluateFaithfulness } from './faithfulness-judge.js';
import { resolveExpectedSources } from './resolve-expected-sources.js';
import { evaluateBlendedVerdict } from './blended-verdict-judge.js';
import type { EvaluationResult } from './evaluation-types.js';

const MAX_RATE_LIMIT_RETRIES = 5;

function isRateLimitError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { status?: unknown }).status === 429
  );
}

function getRetryDelayMs(error: unknown, attempt: number): number {
  const headers = (error as { headers?: unknown } | undefined)?.headers;
  const retryAfter =
    headers && typeof (headers as Headers).get === 'function'
      ? (headers as Headers).get('retry-after')
      : undefined;

  const seconds = retryAfter ? Number(retryAfter) : NaN;
  if (Number.isFinite(seconds)) {
    return seconds * 1000;
  }

  // No Retry-After header: back off exponentially, capped at 30s.
  return Math.min(2 ** attempt * 1000, 30_000);
}

// Groq's free tier enforces a low tokens-per-minute cap, which a full
// evaluation pass (let alone a chunk-size sweep running several passes back
// to back, see chunk-size-sweep.ts) can exceed mid-run. Retrying here keeps
// one rate-limited item from aborting the entire evaluation run.
async function runAgentWithRetry(
  ...args: Parameters<typeof runAgent>
): ReturnType<typeof runAgent> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await runAgent(...args);
    } catch (error) {
      if (!isRateLimitError(error) || attempt >= MAX_RATE_LIMIT_RETRIES) {
        throw error;
      }

      const delayMs = getRetryDelayMs(error, attempt);
      console.warn(
        `Rate limited by the LLM provider, retrying in ${Math.ceil(delayMs / 1000)}s...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export async function runEvaluation() {
  const results: EvaluationResult[] = [];

  for (const item of dataset) {
    const output = await runAgentWithRetry(
      item.question,
      item.userId,
      item.injuryId,
    );

    // A fixture that no longer resolves (renamed/removed in prisma/seed-dev.ts)
    // should only invalidate this case's retrieval score, not the whole run —
    // the other checks below, and every other case in the dataset, are still
    // meaningful even when one case's expected-source description is stale.
    let retrievalPassed: boolean | null;
    try {
      const resolvedExpectedSources = await resolveExpectedSources(
        item.expectedSources ?? [],
        item.userId,
        item.id,
      );
      retrievalPassed = evaluateRetrieval(
        resolvedExpectedSources,
        output.metadata?.retrievedChunks ?? [],
      );
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      retrievalPassed = null;
    }

    results.push({
      id: item.id,
      question: item.question,
      expectedIntent: item.expectedIntent,
      expectedBehavior: item.expectedBehavior,
      output,

      evaluation: {
        safetyPassed: evaluateSafety(item.expectedBehavior, output),
        citationsPassed: evaluateCitations(item.expectedBehavior, output),
        intentPassed: evaluateIntent(item.expectedIntent, output),
        retrievalPassed,
        noInformationPassed: evaluateNoInformation(item.expectedBehavior, output),
        faithfulnessPassed: await evaluateFaithfulness(
          item.expectedBehavior,
          output.answer,
          output.metadata?.retrievedChunks ?? [],
        ),
        blendedVerdictPassed: await evaluateBlendedVerdict(
          item.expectedBehavior,
          output.answer,
          output.metadata?.retrievedChunks ?? [],
        ),
      },
    });
  }

  return results;
}
