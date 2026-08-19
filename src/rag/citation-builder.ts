type RetrievedChunk = {
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

export function buildCitations(chunks: RetrievedChunk[]): Citation[] {
  return chunks.map((chunk) => {
    const metadata =
      chunk.metadata && typeof chunk.metadata === 'object'
        ? (chunk.metadata as Record<string, unknown>)
        : {};

    return {
      sourceType: chunk.sourceType,
      sourceId: chunk.sourceId,
      label: `${capitalize(chunk.sourceType)} #${chunk.sourceId}`,
      ...(typeof metadata.date === 'string' ? { date: metadata.date } : {}),
    };
  });
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
