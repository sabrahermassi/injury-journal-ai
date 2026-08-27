import { checkSafety } from '../../safety/safety-service.js';

export function safetyTool(question: string, requestId?: string) {
  return checkSafety(question, requestId);
}
