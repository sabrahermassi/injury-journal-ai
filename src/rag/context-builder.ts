type RetrievedChunk = {
  content: string;
  metadata?: unknown;
};

export function buildContext(chunks: RetrievedChunk[]): string {
  return chunks
    .map((chunk, index) => {
      return `
Source ${index + 1}:

${chunk.content}
`;
    })
    .join('\n---\n');
}
