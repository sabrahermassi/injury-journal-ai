export type RetrievedChunk = {
  sourceType: string;
  sourceId: number;
  metadata?: unknown;
};

export type Citation = {
  sourceType: string;
  sourceId: number;
  label: string;
  date?: string;
};

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatSourceType(sourceType: string): string {
  return sourceType
    .split('_')
    .map((part) => capitalize(part))
    .join(' ');
}

export function buildCitations(chunks: RetrievedChunk[]): Citation[] {
  const seen = new Set<string>();

  return chunks.flatMap((chunk) => {
    const key = `${chunk.sourceType}:${chunk.sourceId}`;

    if (seen.has(key)) {
      return [];
    }

    seen.add(key);

    const metadata =
      chunk.metadata && typeof chunk.metadata === 'object'
        ? (chunk.metadata as Record<string, unknown>)
        : {};

    return [
      {
        sourceType: chunk.sourceType,
        sourceId: chunk.sourceId,
        label: `${formatSourceType(chunk.sourceType)} #${chunk.sourceId}`,
        ...(typeof metadata.date === 'string' ? { date: metadata.date } : {}),
      },
    ];
  });
}
