import { answerQuestion } from '../../rag/rag-service.js';

export async function ragTool(question: string, limit = 5, injuryId?: number) {
  return answerQuestion(question, limit, injuryId);
}
