import type { AgentIntent } from '../../src/ai-agent/ai-agent-intent-router.js';

export type AgentOutput = {
  answer: string;
  citations: unknown[];
  intent: AgentIntent;
  metadata?: {
    retrievedChunks?: Array<{
      sourceType: string;
      sourceId: number;
      injuryId: number;
    }>;
  };
};

export type EvaluationResult = {
  id: string;
  question: string;
  expectedIntent: string;
  expectedBehavior: string;
  output: AgentOutput;
  evaluation: {
    safetyPassed: boolean | null;
    citationsPassed: boolean | null;
    intentPassed: boolean | null;
    retrievalPassed: boolean | null;
    noInformationPassed: boolean | null;
    faithfulnessPassed: boolean | null;
    blendedVerdictPassed: boolean | null;
  };
};
