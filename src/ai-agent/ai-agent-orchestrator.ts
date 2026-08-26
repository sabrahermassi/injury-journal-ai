import { safetyTool } from './tools/safety-tool.js';
import { ragTool } from './tools/rag-tool.js';
import { journalTool, formatInjuryRecord } from './tools/journal-tool.js';
import { routeIntent } from './ai-agent-intent-router.js';
import { AgentState } from './ai-agent-state.js';
import { buildPrompt } from '../rag/prompt-builder.js';
import { generateAnswer } from '../llm/llm-client.js';

export async function runAgent(question: string, injuryId?: number) {
  const state: AgentState = {
    question,
  };

  const safety = safetyTool(question);

  state.safety = safety;

  if (!safety.allowed) {
    return {
      answer: safety.message,
      citations: [],
      metadata: {
        retrievedChunks: [],
      },
    };
  }

  const intent = routeIntent(question);

  state.intent = intent;

  switch (intent) {
    case 'journal': {
      state.toolUsed = 'journal-tool';

      if (injuryId === undefined) {
        return {
          answer: 'An injury must be selected for journal questions.',
          citations: [],
        };
      }

      const result = await journalTool(injuryId);

      if (!result) {
        return {
          answer: 'No injury record was found.',
          citations: [],
        };
      }

      const context = formatInjuryRecord(result);
      const prompt = buildPrompt(question, context);
      const answer = await generateAnswer(prompt);

      return {
        answer,
        citations: [],
      };
    }

    case 'rag': {
      state.toolUsed = 'rag-tool';

      const result = await ragTool(question, injuryId, 5);

      state.result = result;

      return {
        answer: result.answer,
        citations: result.citations,
        metadata: {
          retrievedChunks: result.chunks.map((chunk) => ({
            sourceType: chunk.sourceType,
            sourceId: chunk.sourceId,
          })),
        },
      };
    }

    default:
      return {
        answer: 'Unable to determine how to handle this request.',
        citations: [],
        metadata: {
          retrievedChunks: [],
        },
      };
  }
}
