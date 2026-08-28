import { answerQuestion } from '../../rag/rag-service.js';

export async function ragTool(
  question: string,
  injuryId: number | undefined,
  userId: number,
  limit = 5,
  requestId?: string,
) {
  return answerQuestion(question, injuryId, userId, limit, requestId);
}
