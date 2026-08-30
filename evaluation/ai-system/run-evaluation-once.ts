import { runEvaluation } from './evaluation-runner.js';
import { generateEvaluationReport } from './evaluation-report.js';
import { disconnectVectorStorage } from '../../src/embeddings/vector-storage.js';

async function main() {
  const results = await runEvaluation();

  for (const result of results) {
    const checks = result.evaluation;
    const failed = Object.entries(checks).filter(([, v]) => v === false);

    if (failed.length > 0) {
      console.log(`FAIL ${result.id}: ${failed.map(([k]) => k).join(', ')}`);
      console.log(`  question: ${result.question}`);
      console.log(`  answer: ${result.output.answer}`);
    } else {
      console.log(`PASS ${result.id}`);
    }
  }

  console.log('--- report ---');
  console.log(JSON.stringify(generateEvaluationReport(results), null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectVectorStorage();
  });
