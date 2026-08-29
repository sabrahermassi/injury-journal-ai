import dataset from './dataset.json' with { type: 'json' };
import { runAgent } from '../../src/ai-agent/ai-agent-orchestrator.js';
import {
  evaluateSafety,
  evaluateCitations,
  evaluateIntent,
  evaluateNoInformation,
} from './evaluator-metrics.js';
import { evaluateRetrieval } from './retrieval-metrics.js';
import { evaluateFaithfulness } from './faithfulness-judge.js';
import type { EvaluationResult } from './evaluation-types.js';

export async function runEvaluation() {
  const results: EvaluationResult[] = [];

  for (const item of dataset) {
    const output = await runAgent(item.question, item.userId, item.injuryId);

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
        retrievalPassed: evaluateRetrieval(
          item.expectedSources ?? [],
          output.metadata?.retrievedChunks ?? [],
        ),
        faithfulnessPassed: await evaluateFaithfulness(
          item.expectedBehavior,
          output.answer,
          output.metadata?.retrievedChunks ?? [],
        ),
        noInformationPassed: evaluateNoInformation(item.expectedBehavior, output),
      },
    });
  }

  return results;
}
