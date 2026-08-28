import { semanticSearch } from '../retrieval/semantic-search.js';
import { buildContext } from './context-builder.js';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompt-builder.js';
import { generateAnswer } from '../llm/llm-client.js';
import { buildCitations } from '../rag/citation-builder.js';
import {
  checkSafety,
  checkContentSafety,
  checkAnswerSafety,
} from '../safety/safety-service.js';
import { prisma } from '../lib/prisma.js';

export async function answerQuestion(
  question: string,
  injuryId: number | undefined,
  userId: number,
  limit = 5,
  requestId?: string,
) {
  const safety = checkSafety(question, requestId);

  if (!safety.allowed) {
    return {
      answer: safety.message,
      chunks: [],
      citations: [],
    };
  }

  if (injuryId !== undefined) {
    const injury = await prisma.injury.findFirst({
      where: { id: injuryId, userId },
      select: { id: true },
    });

    if (!injury) {
      return {
        answer: 'No injury record was found.',
        chunks: [],
        citations: [],
      };
    }
  }

  const chunks = await semanticSearch(question, injuryId, userId, limit, requestId);

  const context = buildContext(chunks, requestId);

  const contentSafety = checkContentSafety(context, requestId);

  if (!contentSafety.allowed) {
    return {
      answer: contentSafety.message,
      chunks: [],
      citations: [],
    };
  }

  const userPrompt = buildUserPrompt(question, context, requestId);

  const answer = await generateAnswer(SYSTEM_PROMPT, userPrompt, requestId);

  const answerSafety = checkAnswerSafety(answer, context, requestId);

  if (!answerSafety.allowed) {
    return {
      answer: answerSafety.message,
      citations: [],
      chunks: [],
    };
  }

  const citations = buildCitations(chunks, requestId);

  return {
    answer,
    citations,
    chunks,
  };
}
