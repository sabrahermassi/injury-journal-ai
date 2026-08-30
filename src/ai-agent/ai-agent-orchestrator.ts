import { safetyTool } from './tools/safety-tool.js';
import { ragTool } from './tools/rag-tool.js';
import { journalTool, formatInjuryRecord } from './tools/journal-tool.js';
import { routeIntent } from './ai-agent-intent-router.js';
import { AgentState } from './ai-agent-state.js';
import { SYSTEM_PROMPT, buildUserPrompt } from '../rag/prompt-builder.js';
import { generateAnswer } from '../llm/llm-client.js';
import {
  checkContentSafety,
  checkAnswerSafety,
  DIAGNOSIS_REQUEST_MESSAGE,
} from '../safety/safety-service.js';

function safetyRefusalResponse(message: string) {
  return {
    answer: message,
    citations: [],
    intent: 'safety' as const,
    metadata: {
      retrievedChunks: [],
    },
  };
}

export async function runAgent(
  question: string,
  userId: number,
  injuryId?: number,
  requestId?: string,
) {
  const state: AgentState = {
    question,
  };

  const safety = safetyTool(question, requestId);

  state.safety = safety;

  if (!safety.allowed) {
    return safetyRefusalResponse(safety.message);
  }

  const intent = routeIntent(question, requestId);

  state.intent = intent;

  switch (intent) {
    case 'safety':
      return safetyRefusalResponse(DIAGNOSIS_REQUEST_MESSAGE);

    case 'journal': {
      state.toolUsed = 'journal-tool';

      if (injuryId === undefined) {
        return {
          answer: 'An injury must be selected for journal questions.',
          citations: [],
          intent,
        };
      }

      const result = await journalTool(injuryId, userId, requestId);

      if (!result) {
        return {
          answer: 'No injury record was found.',
          citations: [],
          intent,
        };
      }

      const context = formatInjuryRecord(result, requestId);

      const contentSafety = checkContentSafety(context, requestId);

      if (!contentSafety.allowed) {
        return {
          answer: contentSafety.message,
          citations: [],
          intent,
        };
      }

      const userPrompt = buildUserPrompt(question, context, requestId);
      const answer = await generateAnswer(SYSTEM_PROMPT, userPrompt, requestId);

      if (!answer) {
        return {
          answer:
            'Unable to generate a summary from your injury record right now.',
          citations: [],
          intent,
        };
      }

      const answerSafety = checkAnswerSafety(answer, context, requestId);

      if (!answerSafety.allowed) {
        return {
          answer: answerSafety.message,
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

      const result = await ragTool(question, injuryId, userId, 5, requestId);

      state.result = result;

      return {
        answer: result.answer,
        citations: result.citations,
        intent,
        metadata: {
          retrievedChunks: result.chunks.map((chunk) => ({
            sourceType: chunk.sourceType,
            sourceId: chunk.sourceId,
            injuryId: chunk.injuryId,
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
