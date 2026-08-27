type RetrievedChunk = {
  content: string;
  metadata?: unknown;
};

export function buildContext(chunks: RetrievedChunk[], requestId?: string): string {
  void requestId; // unused for now — reserved for future log correlation (#32)

  return chunks
    .map((chunk, index) => {
      return `
Source ${index + 1}:

${chunk.content}
`;
    })
    .join('\n---\n');
}
