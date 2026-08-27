export function buildPrompt(
  question: string,
  context: string,
  requestId?: string,
): string {
  void requestId; // unused for now — reserved for future log correlation (#32)

  return `
You are a healthcare journal assistant.

Answer the user's question using only the provided journal information.
If the answer is not present in the journal information, say that you do not have enough information.

Journal information:
${context}

User question:
${question}
`;
}
