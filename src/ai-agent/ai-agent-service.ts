import { ragTool } from './tools/rag-tool.js';

export async function runAgent(request: string, injuryId?: number) {
  const action = 'rag';

  if (action === 'rag') {
    return ragTool(request, injuryId, 5);
  }
}
