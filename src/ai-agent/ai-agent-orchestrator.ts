import { safetyTool } from './tools/safety-tool.js';
import { ragTool } from './tools/rag-tool.js';

export async function runAgent(question: string) {
  // Step 1: Safety check
  const safety = safetyTool(question);

  if (!safety.allowed) {
    return {
      answer: safety.message,
      citations: [],
    };
  }

  // Step 2: Tool selection
  // First version: always use RAG
  const result = await ragTool(question);

  return {
    answer: result.answer,
    citations: result.citations,
  };
}
