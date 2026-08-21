import { semanticSearch } from '../retrieval/semantic-search.js';
import { buildContext } from './context-builder.js';
import { buildPrompt } from './prompt-builder.js';
import { generateAnswer } from '../llm/llm-client.js';
import { buildCitations } from '../rag/citation-builder.js';
import { checkSafety } from '../safety/safety-service.js';

export async function answerQuestion(
  question: string,
  injuryId?: number,
  limit = 5,
) {
  const safety = checkSafety(question);

  if (!safety.allowed) {
    return {
      answer: safety.message,
      chunks: [],
      citations: [],
    };
  }

  const chunks = await semanticSearch(question, injuryId, limit);

  const context = buildContext(chunks);

  const prompt = buildPrompt(question, context);

  const answer = await generateAnswer(prompt);

  const citations = buildCitations(chunks);

  return {
    answer,
    citations,
    chunks,
  };
}
