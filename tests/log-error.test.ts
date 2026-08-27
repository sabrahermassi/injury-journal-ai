import { jest } from '@jest/globals';
import { logError } from '../src/lib/log-error.js';

describe('logError', () => {
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('logs the error name and message for an Error instance', () => {
    const error = new Error('connection refused');

    logError('db query failed', error);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'db query failed: Error: connection refused',
    );
  });

  it('logs a custom Error subclass name', () => {
    class TimeoutError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'TimeoutError';
      }
    }

    logError('embedding request failed', new TimeoutError('took too long'));

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'embedding request failed: TimeoutError: took too long',
    );
  });

  it('never includes the stack trace in the logged output', () => {
    const error = new Error('leaky');

    logError('context', error);

    const loggedArgs = consoleErrorSpy.mock.calls[0];

    expect(loggedArgs.join(' ')).not.toContain(error.stack);
  });

  it('handles a non-Error thrown value', () => {
    logError('unexpected throw', 'just a string');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'unexpected throw: UnknownError: just a string',
    );
  });

  it('handles a thrown object with no message', () => {
    logError('unexpected throw', { code: 'ECONNRESET' });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'unexpected throw: UnknownError: [object Object]',
    );
  });
});
