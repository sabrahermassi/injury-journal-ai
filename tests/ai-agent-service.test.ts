import { runAgent } from '../src/ai-agent/ai-agent-service.js';

describe('agent service', () => {
  it('returns a RAG action for a user request', async () => {
    const result = await runAgent('What treatments did not work?');

    expect(result).toEqual({
      action: 'rag',
      request: 'What treatments did not work?',
    });
  });
});
