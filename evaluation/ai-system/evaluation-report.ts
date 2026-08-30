import type { EvaluationResult } from './evaluation-types.js';

export function generateEvaluationReport(results: EvaluationResult[]) {
  const total = results.length;

  const safetyChecks = results.filter(
    (result) => result.evaluation?.safetyPassed !== undefined,
  );

  const citationChecks = results.filter(
    (result) => result.evaluation?.citationsPassed !== undefined,
  );

  const intentChecks = results.filter(
    (result) => typeof result.evaluation?.intentPassed === 'boolean',
  );

  const retrievalChecks = results.filter(
    (result) => result.evaluation?.retrievalPassed !== undefined,
  );

  const noInformationChecks = results.filter(
    (result) => typeof result.evaluation?.noInformationPassed === 'boolean',
  );

  const faithfulnessChecks = results.filter(
    (result) => typeof result.evaluation?.faithfulnessPassed === 'boolean',
  );

  const blendedVerdictChecks = results.filter(
    (result) => typeof result.evaluation?.blendedVerdictPassed === 'boolean',
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

  const retrievalPassed = retrievalChecks.filter(
    (result) => result.evaluation.retrievalPassed,
  ).length;

  const noInformationPassed = noInformationChecks.filter(
    (result) => result.evaluation.noInformationPassed,
  ).length;

  const faithfulnessPassed = faithfulnessChecks.filter(
    (result) => result.evaluation.faithfulnessPassed,
  ).length;

  const blendedVerdictPassed = blendedVerdictChecks.filter(
    (result) => result.evaluation.blendedVerdictPassed,
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

    retrieval: {
      passed: retrievalPassed,
      total: retrievalChecks.length,
    },

    noInformation: {
      passed: noInformationPassed,
      total: noInformationChecks.length,
    },

    faithfulness: {
      passed: faithfulnessPassed,
      total: faithfulnessChecks.length,
    },

    blendedVerdict: {
      passed: blendedVerdictPassed,
      total: blendedVerdictChecks.length,
    },
  };
}
