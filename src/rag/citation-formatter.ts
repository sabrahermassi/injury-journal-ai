import type { Citation } from './citation-builder.js';

export function formatCitations(citations: Citation[]) {
  return citations.map((citation) => ({
    title: citation.label,
    type: formatType(citation.sourceType),
    ...(citation.date ? { date: citation.date } : {}),
  }));
}

function formatType(value: string): string {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
