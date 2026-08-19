import { safetyTool } from '../src/ai-agent/tools/safety-tool.js';

describe('safety tool', () => {
  it('blocks diagnosis questions', () => {
    const result = safetyTool('Do I have cancer?');

    expect(result.allowed).toBe(false);
  });
});
