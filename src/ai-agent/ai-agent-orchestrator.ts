import { safetyTool } from './tools/safety-tool.js';
import { ragTool } from './tools/rag-tool.js';
import { journalTool } from './tools/journal-tool.js';
import { routeIntent } from './ai-agent-intent-router.js';
import { AgentState } from './ai-agent-state.js';

export async function runAgent(question: string) {
  const state: AgentState = {
    question,
  };

  const safety = safetyTool(question);

  state.safety = safety;

  if (!safety.allowed) {
    return {
      answer: safety.message,
      citations: [],
    };
  }

  const intent = routeIntent(question);

  state.intent = intent;

  switch (intent) {
    case 'journal': {
      state.toolUsed = 'journal-tool';

      const result = await journalTool(question);

      state.result = result;

      return result;
    }

    case 'rag': {
      state.toolUsed = 'rag-tool';

      const result = await ragTool(question);

      state.result = result;

      return result;
    }

    default:
      return {
        answer: safety.message,
        citations: [],
      };
  }
}
