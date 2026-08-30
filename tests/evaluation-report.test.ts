import { generateEvaluationReport } from '../evaluation/ai-system/evaluation-report.js';

describe('evaluation report', () => {
  it('generates summary from evaluation results', () => {
    const results = [
      {
        evaluation: {
          intentPassed: true,
          safetyPassed: true,
          citationsPassed: true,
        },
      },
      {
        evaluation: {
          intentPassed: false,
          safetyPassed: true,
          citationsPassed: false,
        },
      },
    ];

    const report = generateEvaluationReport(results);

    expect(report).toEqual({
      totalCases: 2,

      intent: {
        passed: 1,
        total: 2,
      },

      safety: {
        passed: 2,
        total: 2,
      },

      citations: {
        passed: 1,
        total: 2,
      },

      retrieval: {
        passed: 0,
        total: 0,
      },

      noInformation: {
        passed: 0,
        total: 0,
      },

      faithfulness: {
        passed: 0,
        total: 0,
      },

      blendedVerdict: {
        passed: 0,
        total: 0,
      },
    });
  });

  it('counts faithfulness results when present', () => {
    const results = [
      {
        evaluation: {
          intentPassed: true,
          safetyPassed: true,
          citationsPassed: true,
          faithfulnessPassed: true,
        },
      },
      {
        evaluation: {
          intentPassed: true,
          safetyPassed: true,
          citationsPassed: true,
          faithfulnessPassed: false,
        },
      },
    ];

    const report = generateEvaluationReport(results);

    expect(report.faithfulness).toEqual({
      passed: 1,
      total: 2,
    });
  });

  it('excludes unparseable (null) faithfulness verdicts from the total', () => {
    const results = [
      {
        evaluation: {
          intentPassed: true,
          safetyPassed: true,
          citationsPassed: true,
          faithfulnessPassed: true,
        },
      },
      {
        evaluation: {
          intentPassed: true,
          safetyPassed: true,
          citationsPassed: true,
          faithfulnessPassed: null,
        },
      },
    ];

    const report = generateEvaluationReport(results);

    expect(report.faithfulness).toEqual({
      passed: 1,
      total: 1,
    });
  });

  it('counts blended-verdict results when present', () => {
    const results = [
      {
        evaluation: {
          intentPassed: true,
          safetyPassed: true,
          citationsPassed: true,
          blendedVerdictPassed: true,
        },
      },
      {
        evaluation: {
          intentPassed: true,
          safetyPassed: true,
          citationsPassed: true,
          blendedVerdictPassed: false,
        },
      },
    ];

    const report = generateEvaluationReport(results);

    expect(report.blendedVerdict).toEqual({
      passed: 1,
      total: 2,
    });
  });

  it('excludes unparseable (null) blended-verdict verdicts from the total', () => {
    const results = [
      {
        evaluation: {
          intentPassed: true,
          safetyPassed: true,
          citationsPassed: true,
          blendedVerdictPassed: true,
        },
      },
      {
        evaluation: {
          intentPassed: true,
          safetyPassed: true,
          citationsPassed: true,
          blendedVerdictPassed: null,
        },
      },
    ];

    const report = generateEvaluationReport(results);

    expect(report.blendedVerdict).toEqual({
      passed: 1,
      total: 1,
    });
  });
});
