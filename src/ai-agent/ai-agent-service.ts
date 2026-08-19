export async function runAgent(request: string) {
  return {
    action: 'rag',
    request,
  };
}
