export interface AgentState {
  question: string;

  safety?: {
    allowed: boolean;
    message?: string;
  };

  intent?: 'rag' | 'journal' | 'safety';

  toolUsed?: string;

  result?: {
    answer: string;
    citations: unknown[];
  };
}
