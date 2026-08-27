import { safetyTool } from './tools/safety-tool.js';
import { ragTool } from './tools/rag-tool.js';
import { journalTool, formatInjuryRecord } from './tools/journal-tool.js';
import { routeIntent } from './ai-agent-intent-router.js';
import { AgentState } from './ai-agent-state.js';
import { buildPrompt } from '../rag/prompt-builder.js';
import { generateAnswer } from '../llm/llm-client.js';

export async function runAgent(
  question: string,
  injuryId?: number,
  requestId?: string,
) {
  const state: AgentState = {
    question,
  };

  const safety = safetyTool(question, requestId);

  state.safety = safety;

  if (!safety.allowed) {
    return {
      answer: safety.message,
      citations: [],
      intent: 'safety' as const,
      metadata: {
        retrievedChunks: [],
      },
    };
  }

  const intent = routeIntent(question, requestId);

  state.intent = intent;

  switch (intent) {
    case 'journal': {
      state.toolUsed = 'journal-tool';

      if (injuryId === undefined) {
        return {
          answer: 'An injury must be selected for journal questions.',
          citations: [],
          intent,
        };
      }

      const result = await journalTool(injuryId, requestId);

      if (!result) {
        return {
          answer: 'No injury record was found.',
          citations: [],
          intent,
        };
      }

      const context = formatInjuryRecord(result, requestId);
      const prompt = buildPrompt(question, context, requestId);
      const answer = await generateAnswer(prompt, requestId);

      if (!answer) {
        return {
          answer:
            'Unable to generate a summary from your injury record right now.',
          citations: [],
          intent,
        };
      }

      return {
        answer,
        citations: [],
        intent,
      };
    }

    case 'rag': {
      state.toolUsed = 'rag-tool';

      const result = await ragTool(question, injuryId, 5, requestId);

      state.result = result;

      return {
        answer: result.answer,
        citations: result.citations,
        intent,
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
        intent,
        metadata: {
          retrievedChunks: [],
        },
      };
  }
}
