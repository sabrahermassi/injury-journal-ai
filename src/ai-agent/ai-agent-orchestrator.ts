import { safetyTool } from './tools/safety-tool.js';
import { ragTool } from './tools/rag-tool.js';
import { journalTool } from './tools/journal-tool.js';
import { routeIntent } from './ai-agent-intent-router.js';

export async function runAgent(question: string) {
  // Step 1: Safety check
  const safety = safetyTool(question);

  if (!safety.allowed) {
    return {
      answer: safety.message,
      citations: [],
    };
  }

  // Step 2: Decide which tool to use
  const intent = routeIntent(question);

  switch (intent) {
    case 'journal': {
      const result = await journalTool(question);

      return {
        answer: result.answer,
        citations: result.citations,
      };
    }

    case 'rag': {
      const result = await ragTool(question);

      return {
        answer: result.answer,
        citations: result.citations,
      };
    }

    default:
      return {
        answer: safety.message,
        citations: [],
      };
  }
}
