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
      // Injury.name has no uniqueness constraint, so two different injuries can share a
      // name — always include the id so an unscoped query's sources stay distinguishable.
      const injuryName = injuryNames.get(chunk.injuryId) ?? `Injury #${chunk.injuryId}`;
      const injuryLabel = `${injuryName} (#${chunk.injuryId})`;

      return `
Source ${index + 1} (Injury: ${injuryLabel}):

${chunk.content}
`;
    })
    .join('\n---\n');
}
