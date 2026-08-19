import { semanticSearch } from '../retrieval/semantic-search.js';
import { buildContext } from './context-builder.js';
import { buildPrompt } from './prompt-builder.js';
import { generateAnswer } from '../llm/llm-client.js';

export async function answerQuestion(
  question: string,
  injuryId?: number,
  limit = 5,
) {
  const chunks = await semanticSearch(question, limit, injuryId);

  const context = buildContext(chunks);

  const prompt = buildPrompt(question, context);

  const answer = await generateAnswer(prompt);

  return {
    answer,
    chunks,
  };
}
