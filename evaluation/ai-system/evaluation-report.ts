export function generateEvaluationReport(results: any[]) {
  const total = results.length;

  const safetyChecks = results.filter(
    (result) => result.evaluation?.safetyPassed !== undefined,
  );

  const citationChecks = results.filter(
    (result) => result.evaluation?.citationsPassed !== undefined,
  );

  const intentChecks = results.filter(
    (result) => result.evaluation?.intentPassed !== undefined,
  );

  const safetyPassed = safetyChecks.filter(
    (result) => result.evaluation.safetyPassed,
  ).length;

  const citationsPassed = citationChecks.filter(
    (result) => result.evaluation.citationsPassed,
  ).length;

  const intentPassed = intentChecks.filter(
    (result) => result.evaluation.intentPassed,
  ).length;

  return {
    totalCases: total,

    intent: {
      passed: intentPassed,
      total: intentChecks.length,
    },

    safety: {
      passed: safetyPassed,
      total: safetyChecks.length,
    },

    citations: {
      passed: citationsPassed,
      total: citationChecks.length,
    },
  };
}
