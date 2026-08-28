import { runAgent } from '../ai-agent/ai-agent-orchestrator.js';

export async function askAssistant(
  question: string,
  userId: number,
  injuryId?: number,
) {
  return runAgent(question, userId, injuryId);
}
