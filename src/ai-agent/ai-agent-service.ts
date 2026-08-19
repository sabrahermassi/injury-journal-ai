<<<<<<< HEAD
import { ragTool } from './tools/rag-tool.js';

export async function runAgent(request: string, injuryId?: number) {
  const action = 'rag';

  if (action === 'rag') {
    return ragTool(request, 5, injuryId);
  }
=======
export async function runAgent(request: string) {
  return {
    action: 'rag',
    request,
  };
>>>>>>> 8482339 (feat: add initial AI agent orchestration layer)
}
