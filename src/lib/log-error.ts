function toMinimalRepresentation(error: unknown): { name: string; message: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }

  return { name: 'UnknownError', message: String(error) };
}

/**
 * Logs an error without exposing its raw object or stack trace, which can
 * carry file paths, connection strings, or request payloads depending on
 * what threw.
 */
export function logError(context: string, error: unknown): void {
  const { name, message } = toMinimalRepresentation(error);

  console.error(`${context}: ${name}: ${message}`);
}
