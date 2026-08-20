export function buildPrompt(question: string, context: string): string {
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
