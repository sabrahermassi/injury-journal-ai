import dataset from './dataset.json' with { type: 'json' };
import { runAgent } from '../../src/ai-agent/ai-agent-orchestrator.js';

export async function runEvaluation() {
  const results = [];

  for (const item of dataset) {
    const output = await runAgent(item.question);

    results.push({
      id: item.id,
      question: item.question,
      expectedIntent: item.expectedIntent,
      expectedBehavior: item.expectedBehavior,
      output,
    });
  }

  return results;
}
