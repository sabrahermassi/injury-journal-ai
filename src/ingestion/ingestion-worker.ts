import { pathToFileURL } from 'node:url';
import { prisma } from '../lib/prisma.js';
import { readJournalData } from './reader/postgres-reader.js';
import { buildJournalDocuments } from './documents/document-builder.js';
import { embedAndStoreDocument } from './embed-and-store.js';
import type { JournalDocument } from './documents/document-types.js';

export interface IngestionFailure {
  sourceType: JournalDocument['metadata']['sourceType'];
  sourceId: number;
  injuryId: number;
  error: unknown;
}

export interface IngestionResult {
  total: number;
  succeeded: number;
  failed: IngestionFailure[];
}

/**
 * Runs one full ingestion pass: reads all journal data, builds documents,
 * and embeds/stores each document sequentially. A single document failing
 * does not abort the run -- it is logged and collected in `failed`, and the
 * run continues, since one bad record should not block ingestion of every
 * other user's data.
 *
 * Each document is stored independently and immediately as it succeeds --
 * there is no cross-document transaction. A non-empty `failed` array means
 * a PARTIAL failure, not a rollback: every document counted in `succeeded`
 * is already durably committed and stays that way regardless of what
 * happens to documents processed afterward.
 */
export async function runIngestion(): Promise<IngestionResult> {
  const injuries = await readJournalData();
  const documents = buildJournalDocuments(injuries);

  const result: IngestionResult = {
    total: documents.length,
    succeeded: 0,
    failed: [],
  };

  for (const document of documents) {
    try {
      await embedAndStoreDocument(document);
      result.succeeded += 1;
    } catch (error) {
      console.error(
        `Ingestion failed for sourceType=${document.metadata.sourceType} ` +
          `sourceId=${document.metadata.sourceId} injuryId=${document.metadata.injuryId}:`,
        error,
      );
      result.failed.push({
        sourceType: document.metadata.sourceType,
        sourceId: document.metadata.sourceId,
        injuryId: document.metadata.injuryId,
        error,
      });
    }
  }

  return result;
}

async function main() {
  const result = await runIngestion();

  console.log(
    `Ingestion complete: ${result.succeeded}/${result.total} documents succeeded, ` +
      `${result.failed.length} failed.`,
  );

  if (result.failed.length > 0) {
    throw new Error(
      `Ingestion completed with ${result.failed.length} of ${result.total} document(s) failed. ` +
        `This is a PARTIAL failure, not a rollback: the ${result.succeeded} document(s) that ` +
        `succeeded are already committed to the database. Re-running ingestion is safe -- it will ` +
        `re-upsert already-succeeded documents (a no-op) and retry the failed ones.`,
    );
  }
}

// Only run as a script (`npm run ingest` / `tsx ingestion-worker.ts`), not
// when `runIngestion` is imported elsewhere (e.g. by unit tests).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
