import { runAgent } from '../ai-agent/ai-agent-orchestrator.js';

export async function askAssistant(question: string, injuryId?: number) {
  return runAgent(question, injuryId);
}
