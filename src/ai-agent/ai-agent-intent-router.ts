export type AgentIntent = 'rag' | 'journal' | 'safety';

export function routeIntent(question: string, requestId?: string): AgentIntent {
  void requestId; // unused for now — reserved for future log correlation (#32)

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
