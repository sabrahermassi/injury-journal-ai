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
    });
  });
});
