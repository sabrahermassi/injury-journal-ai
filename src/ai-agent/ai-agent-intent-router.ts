export type AgentIntent = 'rag' | 'journal' | 'safety';

export function routeIntent(question: string): AgentIntent {
  const normalized = question.toLowerCase();

  if (
    normalized.includes('diagnose') ||
    normalized.includes('do i have') ||
    normalized.includes('cancer') ||
    normalized.includes('condition')
  ) {
    return 'safety';
  }

  if (
    normalized.includes('timeline') ||
    normalized.includes('history') ||
    normalized.includes('when') ||
    normalized.includes('events')
  ) {
    return 'journal';
  }

  return 'rag';
}
