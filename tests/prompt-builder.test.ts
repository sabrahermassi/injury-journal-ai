import { buildPrompt } from '../src/rag/prompt-builder.js';

describe('buildPrompt', () => {
  it('includes context and question', () => {
    const prompt = buildPrompt(
      'What treatments did not work?',
      'Shockwave therapy did not help.',
    );

    expect(prompt).toContain('Shockwave therapy did not help.');

    expect(prompt).toContain('What treatments did not work?');
  });

  it('includes grounding instructions', () => {
    const prompt = buildPrompt('Question', 'Context');

    expect(prompt).toContain('using only the provided journal information');
  });
});
