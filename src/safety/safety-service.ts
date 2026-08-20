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

  /am i sick/i,

  /what (is|are) my symptoms (of|for)\s+.+/i,

  /(can you|please)?\s*diagnose me/i,

  /what condition do i have/i,

  /what disease do i have/i,

  /what diagnosis do i have/i,

  /what is wrong with me/i,

  /is this (cancer|a disease|a condition|serious|dangerous)/i,

  /could this be (cancer|a disease|a condition|an injury|a fracture|a tear|a syndrome|a disorder)/i,
];

export function checkSafety(question: string): SafetyResult {
  const normalizedQuestion = question.replace(/\s+/g, ' ').trim();

  const isDiagnosisRequest = diagnosisPatterns.some((pattern) =>
    pattern.test(normalizedQuestion),
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
