import { routeIntent } from '../src/ai-agent/ai-agent-intent-router.js';

describe('ai agent intent router', () => {
  it('routes diagnosis questions to safety', () => {
    const result = routeIntent('Do I have cancer?');

    expect(result).toBe('safety');
  });

  it('routes timeline questions to journal', () => {
    const result = routeIntent('Show my injury timeline');

    expect(result).toBe('journal');
  });

  it('routes treatment questions to rag', () => {
    const result = routeIntent('What treatments failed?');

    expect(result).toBe('rag');
  });

  it('defaults unknown questions to rag', () => {
    const result = routeIntent('Tell me something about my injury');

    expect(result).toBe('rag');
  });
});
