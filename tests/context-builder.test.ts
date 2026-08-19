import { buildContext } from '../src/rag/context-builder.js';

describe('buildContext', () => {
  it('builds context from retrieved chunks', () => {
    const context = buildContext([
      {
        content: 'Shockwave therapy did not help.',
      },
      {
        content: 'Injection reduced pain temporarily.',
      },
    ]);

    expect(context).toContain('Shockwave therapy did not help.');

    expect(context).toContain('Injection reduced pain temporarily.');
  });

  it('returns empty string for no chunks', () => {
    expect(buildContext([])).toBe('');
  });
});
