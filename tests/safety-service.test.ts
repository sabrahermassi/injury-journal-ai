import { checkSafety } from '../src/safety/safety-service.js';

describe('safety service', () => {
  it('allows journal summary questions', () => {
    const result = checkSafety('Summarize my treatments and what worked.');

    expect(result).toEqual({
      allowed: true,
    });
  });

  it('blocks diagnosis requests', () => {
    const result = checkSafety('Do I have cancer?');

    expect(result).toEqual({
      allowed: false,
      reason: 'diagnosis_request',
      message:
        'I cannot diagnose medical conditions, but I can help summarize your recorded symptoms, tests, treatments, and medical history.',
    });
  });

  it('blocks direct diagnosis wording', () => {
    const result = checkSafety('Diagnose me based on my symptoms.');

    expect(result.allowed).toBe(false);
  });

  it('allows medical history questions', () => {
    const result = checkSafety('What symptoms did I record last month?');

    expect(result).toEqual({
      allowed: true,
    });
  });

  it('blocks common diagnosis requests', () => {
    const unsafeQuestions = [
      'Could this be cancer?',
      'What condition do I have?',
      'What diagnosis do I have?',
      'What is wrong with me?',
    ];

    unsafeQuestions.forEach((question) => {
      const result = checkSafety(question);

      expect(result.allowed).toBe(false);
    });
  });
});
