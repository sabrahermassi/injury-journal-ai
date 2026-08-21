export function evaluateRetrieval(
  expectedSources: Array<{
    sourceType: string;
    sourceId: number;
  }>,
  retrievedChunks: Array<{
    sourceType: string;
    sourceId: number;
  }>,
) {
  if (expectedSources.length === 0) {
    return true;
  }

  return expectedSources.every((expected) =>
    retrievedChunks.some(
      (chunk) =>
        chunk.sourceType === expected.sourceType &&
        chunk.sourceId === expected.sourceId,
    ),
  );
}
