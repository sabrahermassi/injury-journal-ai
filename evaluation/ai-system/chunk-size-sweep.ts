import { runIngestion } from '../../src/ingestion/ingestion-worker.js';
import { runEvaluation } from './evaluation-runner.js';
import { generateEvaluationReport } from './evaluation-report.js';
import { prisma } from '../../src/lib/prisma.js';

// Sweeps maxTokens only, matching the chunker as it exists on main today.
// PRs #213 (Qwen3 tokenizer safety margin) and #214 (chunk overlap) are open
// but unmerged as of this writing -- once either lands, extend this sweep to
// also vary overlapTokens / account for the safety margin rather than
// treating maxTokens as the only knob.
const CANDIDATE_MAX_TOKENS = [150, 300, 450, 600];

async function main() {
  const rows: Record<string, string | number>[] = [];

  for (const maxTokens of CANDIDATE_MAX_TOKENS) {
    console.log(`Re-ingesting with maxTokens=${maxTokens}...`);
    const ingestionResult = await runIngestion(maxTokens);

    if (ingestionResult.failed.length > 0) {
      throw new Error(
        `Ingestion failed for ${ingestionResult.failed.length}/${ingestionResult.total} ` +
          `document(s) at maxTokens=${maxTokens}; aborting sweep.`,
      );
    }

    const results = await runEvaluation();
    const report = generateEvaluationReport(results);

    rows.push({
      maxTokens,
      retrieval: `${report.retrieval.passed}/${report.retrieval.total}`,
      citations: `${report.citations.passed}/${report.citations.total}`,
      faithfulness: `${report.faithfulness.passed}/${report.faithfulness.total}`,
    });
  }

  console.table(rows);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
