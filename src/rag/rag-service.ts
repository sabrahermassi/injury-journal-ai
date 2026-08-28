import { semanticSearch } from '../retrieval/semantic-search.js';
import { buildContext } from './context-builder.js';
import { buildPrompt } from './prompt-builder.js';
import { generateAnswer } from '../llm/llm-client.js';
import { buildCitations } from '../rag/citation-builder.js';
import { checkSafety, checkAnswerSafety } from '../safety/safety-service.js';

export async function answerQuestion(
  question: string,
  injuryId?: number,
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

  const chunks = await semanticSearch(question, injuryId, limit, requestId);

  const context = buildContext(chunks, requestId);

  const prompt = buildPrompt(question, context, requestId);

  const answer = await generateAnswer(prompt, requestId);

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
