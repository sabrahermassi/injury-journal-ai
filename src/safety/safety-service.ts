export type SafetyResult =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      reason: string;
      message: string;
    };

const diagnosisPatterns = [
  /do i have (a|an)?\s*(.+)?(injury|condition|disease|syndrome|disorder|diagnosis|tear|fracture|cancer|tumou?r|disc|herniation)/i,

  /am i (suffering from|experiencing|showing signs of)\s+.+/i,

  /what (is|are) my symptoms (of|for)\s+.+/i,

  /(can you|please)?\s*diagnose me/i,

  /what condition do i have/i,

  /what disease do i have/i,

  /what diagnosis do i have/i,

  /what is wrong with me/i,

  /could this be .+/i,
];

export function checkSafety(question: string): SafetyResult {
  const isDiagnosisRequest = diagnosisPatterns.some((pattern) =>
    pattern.test(question),
  );

  if (isDiagnosisRequest) {
    return {
      allowed: false,
      reason: 'diagnosis_request',
      message:
        'I cannot diagnose medical conditions, but I can help summarize your recorded symptoms, tests, treatments, and medical history.',
    };
  }

  return {
    allowed: true,
  };
}
