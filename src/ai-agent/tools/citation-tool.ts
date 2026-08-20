import type { RetrievedChunk } from '../../rag/citation-builder.js';
import { buildCitations } from '../../rag/citation-builder.js';

export function citationTool(chunks: RetrievedChunk[]) {
  return buildCitations(chunks);
}
