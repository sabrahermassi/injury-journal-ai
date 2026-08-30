import { runIngestion } from '../../src/ingestion/ingestion-worker.js';
import { runEvaluation } from './evaluation-runner.js';
import { generateEvaluationReport } from './evaluation-report.js';
import { prisma } from '../../src/lib/prisma.js';

// Sweeps maxTokens only; overlapTokens (#214) is left at chunkDocument's own
// default at every candidate. Extend this to also vary overlapTokens if
// overlap tuning is ever in scope -- for now this only answers the maxTokens
// question #137 was scoped to.
const CANDIDATE_MAX_TOKENS = [150, 300, 450, 600];

// This re-ingests every document in whatever DATABASE_URL points at, once
// per candidate. Guarded the same way prisma/seed-dev.ts guards its own
// destructive dev-only operation, since a misconfigured DATABASE_URL here
// would otherwise silently re-chunk/re-embed real data multiple times.
function assertSafeToRunAgainstThisDatabase(): void {
  if (process.env.DATABASE_ENV !== 'development') {
    throw new Error(
      'Refusing to run the chunk-size sweep: DATABASE_ENV must be "development".',
    );
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('Refusing to run the chunk-size sweep: DATABASE_URL is not set.');
  }

  const databaseName = new URL(databaseUrl).pathname.slice(1);

  if (databaseName !== 'injury-journal-ai-db') {
    throw new Error(
      `Refusing to run the chunk-size sweep: unexpected database "${databaseName}".`,
    );
  }
}

async function main() {
  assertSafeToRunAgainstThisDatabase();

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
