export type RetrievedChunk = {
  sourceType: string;
  sourceId: number;
  injuryId: number;
  metadata?: unknown;
};

export type Citation = {
  sourceType: string;
  sourceId: number;
  label: string;
  injuryId: number;
  injuryName?: string;
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

export function buildCitations(
  chunks: RetrievedChunk[],
  injuryNames: Map<number, string>,
  requestId?: string,
): Citation[] {
  void requestId; // unused for now — reserved for future log correlation (#32)

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

    const injuryName = injuryNames.get(chunk.injuryId);

    return [
      {
        sourceType: chunk.sourceType,
        sourceId: chunk.sourceId,
        label: `${formatSourceType(chunk.sourceType)} #${chunk.sourceId}`,
        injuryId: chunk.injuryId,
        ...(injuryName !== undefined ? { injuryName } : {}),
        ...(typeof metadata.date === 'string' ? { date: metadata.date } : {}),
      },
    ];
  });
}
