import { checkSafety } from '../../safety/safety-service.js';

export function safetyTool(question: string) {
  return checkSafety(question);
}
