import { buildCitations } from '../../rag/citation-builder.js';

export function citationTool(chunks: unknown[]) {
  return buildCitations(chunks);
}
