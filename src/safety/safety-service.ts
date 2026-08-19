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
  /do i have .+/i,
  /what disease do i have/i,
  /am i sick/i,
  /is this cancer/i,
  /diagnose me/i,
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
