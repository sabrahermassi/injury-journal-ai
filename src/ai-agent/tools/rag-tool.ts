import { answerQuestion } from '../../rag/rag-service.js';

export async function ragTool(question: string, injuryId?: number, limit = 5) {
  return answerQuestion(question, injuryId, limit);
}
