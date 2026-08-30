type RetrievedChunk = {
  content: string;
  injuryId: number;
  metadata?: unknown;
};

export function buildContext(
  chunks: RetrievedChunk[],
  injuryNames: Map<number, string>,
  requestId?: string,
): string {
  void requestId; // unused for now — reserved for future log correlation (#32)

  return chunks
    .map((chunk, index) => {
      const injuryLabel = injuryNames.get(chunk.injuryId) ?? `Injury #${chunk.injuryId}`;

      return `
Source ${index + 1} (Injury: ${injuryLabel}):

${chunk.content}
`;
    })
    .join('\n---\n');
}
