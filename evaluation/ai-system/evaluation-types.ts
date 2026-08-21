export type AgentOutput = {
  answer: string;
  citations: unknown[];
  metadata?: {
    retrievedChunks?: Array<{
      sourceType: string;
      sourceId: number;
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
  };
};
