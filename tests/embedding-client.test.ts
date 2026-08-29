import { jest } from '@jest/globals';

/**
 * embedText() reads EMBEDDING_API_URL / EMBEDDING_API_TIMEOUT_MS from
 * process.env once, at module load time. To exercise different
 * configurations we reset the module registry and dynamically re-import
 * the module for every test that cares about env-driven configuration.
 */
async function loadEmbeddingClient() {
  jest.resetModules();
  return import('../src/embeddings/embedding-client.js');
}

const TEST_EMBEDDING = Array.from({ length: 1024 }, (_, i) => i / 1024);

function makeResponse(
  overrides: Partial<{
    ok: boolean;
    status: number;
    statusText: string;
    json: () => Promise<unknown>;
  }> = {},
) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({
      embedding: TEST_EMBEDDING,
      model: 'Qwen/Qwen3-Embedding-0.6B',
      modelVersion: 'abc123',
      dimension: 1024,
      version: 'qwen3-embedding-0.6b-v1',
    }),
    ...overrides,
  } as unknown as Response;
}

const ORIGINAL_ENV = { ...process.env };
const originalFetch = global.fetch;

describe('embedText', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    global.fetch = originalFetch;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('sends a POST request to the default embedding API URL with the expected payload', async () => {
    delete process.env.EMBEDDING_API_URL;
    process.env.EMBEDDING_API_KEY = 'test-embedding-key';

    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(
      makeResponse({
        json: async () => ({
          embedding: TEST_EMBEDDING,
          model: 'Qwen/Qwen3-Embedding-0.6B',
          modelVersion: 'abc123',
          dimension: 1024,
          version: 'qwen3-embedding-0.6b-v1',
        }),
      }),
    );

    global.fetch = fetchMock as unknown as typeof fetch;

    const { embedText } = await loadEmbeddingClient();

    const result = await embedText('hello world');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/embed',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-embedding-key',
        },
        body: JSON.stringify({ text: 'hello world' }),
      }),
    );

    expect(result).toEqual({
      embedding: TEST_EMBEDDING,
      model: 'Qwen/Qwen3-Embedding-0.6B',
      modelVersion: 'abc123',
      dimension: 1024,
      version: 'qwen3-embedding-0.6b-v1',
    });
  });

  it('uses a custom EMBEDDING_API_URL when configured', async () => {
    process.env.EMBEDDING_API_URL = 'http://embedding-service:9000';

    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(makeResponse());

    global.fetch = fetchMock as unknown as typeof fetch;

    const { embedText } = await loadEmbeddingClient();
    await embedText('hi');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://embedding-service:9000/embed',
      expect.anything(),
    );
  });

  it('passes an AbortSignal to fetch', async () => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(makeResponse());

    global.fetch = fetchMock as unknown as typeof fetch;

    const { embedText } = await loadEmbeddingClient();
    await embedText('hi');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('throws a descriptive EmbeddingServiceError when the response is not ok', async () => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(
      makeResponse({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      }),
    );

    global.fetch = fetchMock as unknown as typeof fetch;

    const { embedText, EmbeddingServiceError } = await loadEmbeddingClient();

    await expect(embedText('hi')).rejects.toThrow(
      'Embedding API request failed: 500 Internal Server Error',
    );
    await expect(embedText('hi')).rejects.toBeInstanceOf(EmbeddingServiceError);
  });

  it('wraps network errors thrown by fetch in an EmbeddingServiceError', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('network down'));

    global.fetch = fetchMock as unknown as typeof fetch;

    const { embedText, EmbeddingServiceError } = await loadEmbeddingClient();

    await expect(embedText('hi')).rejects.toThrow('network down');
    await expect(embedText('hi')).rejects.toBeInstanceOf(EmbeddingServiceError);
  });

  it('wraps a malformed (non-JSON) response body in an EmbeddingServiceError', async () => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(
      makeResponse({
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON at position 0');
        },
      }),
    );

    global.fetch = fetchMock as unknown as typeof fetch;

    const { embedText, EmbeddingServiceError } = await loadEmbeddingClient();

    await expect(embedText('hi')).rejects.toThrow(
      'Embedding API returned a malformed response',
    );
    await expect(embedText('hi')).rejects.toBeInstanceOf(EmbeddingServiceError);
  });

  it('sets EmbeddingServiceError.name so logs identify the error class', async () => {
    delete process.env.EMBEDDING_API_KEY;

    const { embedText, EmbeddingServiceError } = await loadEmbeddingClient();

    try {
      await embedText('hi');
      throw new Error('expected embedText to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(EmbeddingServiceError);
      expect((error as Error).name).toBe('EmbeddingServiceError');
    }
  });

  it('clears the timeout after a successful request', async () => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(makeResponse());

    global.fetch = fetchMock as unknown as typeof fetch;

    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    const { embedText } = await loadEmbeddingClient();
    await embedText('hi');

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
  });

  it('clears the timeout even when the request fails', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('network down'));

    global.fetch = fetchMock as unknown as typeof fetch;

    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    const { embedText } = await loadEmbeddingClient();

    await expect(embedText('hi')).rejects.toThrow('network down');

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
  });

  it('uses the default 30 second timeout when EMBEDDING_API_TIMEOUT_MS is not set', async () => {
    delete process.env.EMBEDDING_API_TIMEOUT_MS;

    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(makeResponse());

    global.fetch = fetchMock as unknown as typeof fetch;

    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    const { embedText } = await loadEmbeddingClient();
    await embedText('hi');

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 30000);
  });

  it.each(['not-a-number', '-100', '0', ''])(
    'falls back to the default timeout when EMBEDDING_API_TIMEOUT_MS is invalid (%s)',
    async (value) => {
      process.env.EMBEDDING_API_TIMEOUT_MS = value;

      const fetchMock = jest
        .fn<typeof fetch>()
        .mockResolvedValue(makeResponse());

      global.fetch = fetchMock as unknown as typeof fetch;

      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      const { embedText } = await loadEmbeddingClient();
      await embedText('hi');

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 30000);
    },
  );

  it('uses a valid custom EMBEDDING_API_TIMEOUT_MS when provided', async () => {
    process.env.EMBEDDING_API_TIMEOUT_MS = '5000';

    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(makeResponse());

    global.fetch = fetchMock as unknown as typeof fetch;

    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    const { embedText } = await loadEmbeddingClient();
    await embedText('hi');

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
  });

  it('aborts the underlying request once the configured timeout elapses', async () => {
    jest.useFakeTimers();
    process.env.EMBEDDING_API_TIMEOUT_MS = '100';

    const fetchMock = jest.fn((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('This operation was aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    const { embedText } = await loadEmbeddingClient();

    const promise = embedText('hi');

    const expectation = expect(promise).rejects.toThrow(
      'This operation was aborted',
    );

    await jest.advanceTimersByTimeAsync(100);

    await expectation;
  });

  it('does not abort the request if it completes before the timeout elapses', async () => {
    jest.useFakeTimers();
    process.env.EMBEDDING_API_TIMEOUT_MS = '10000';

    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(makeResponse());

    global.fetch = fetchMock as unknown as typeof fetch;

    const { embedText } = await loadEmbeddingClient();

    const result = await embedText('hi');

    expect(result.embedding).toEqual(TEST_EMBEDDING);
  });

  it('throws an EmbeddingServiceError without calling fetch when EMBEDDING_API_KEY is not configured', async () => {
    delete process.env.EMBEDDING_API_KEY;

    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(makeResponse());

    global.fetch = fetchMock as unknown as typeof fetch;

    const { embedText, EmbeddingServiceError } = await loadEmbeddingClient();

    await expect(embedText('hi')).rejects.toThrow(
      'EMBEDDING_API_KEY is not configured',
    );
    await expect(embedText('hi')).rejects.toBeInstanceOf(EmbeddingServiceError);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('embedQuery', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('sends a POST request to /embed-query, not /embed', async () => {
    delete process.env.EMBEDDING_API_URL;
    process.env.EMBEDDING_API_KEY = 'test-embedding-key';

    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(makeResponse());

    global.fetch = fetchMock as unknown as typeof fetch;

    const { embedQuery } = await loadEmbeddingClient();
    const result = await embedQuery('what treatments have I tried?');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/embed-query',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-embedding-key',
        },
        body: JSON.stringify({ text: 'what treatments have I tried?' }),
      }),
    );

    expect(result.embedding).toEqual(TEST_EMBEDDING);
  });

  it('uses a custom EMBEDDING_API_URL when configured', async () => {
    process.env.EMBEDDING_API_URL = 'http://embedding-service:9000';

    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(makeResponse());

    global.fetch = fetchMock as unknown as typeof fetch;

    const { embedQuery } = await loadEmbeddingClient();
    await embedQuery('hi');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://embedding-service:9000/embed-query',
      expect.anything(),
    );
  });

  it('throws a descriptive EmbeddingServiceError when the response is not ok', async () => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(
      makeResponse({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      }),
    );

    global.fetch = fetchMock as unknown as typeof fetch;

    const { embedQuery, EmbeddingServiceError } = await loadEmbeddingClient();

    await expect(embedQuery('hi')).rejects.toThrow(
      'Embedding API request failed: 500 Internal Server Error',
    );
    await expect(embedQuery('hi')).rejects.toBeInstanceOf(EmbeddingServiceError);
  });

  it('throws an EmbeddingServiceError without calling fetch when EMBEDDING_API_KEY is not configured', async () => {
    delete process.env.EMBEDDING_API_KEY;

    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(makeResponse());

    global.fetch = fetchMock as unknown as typeof fetch;

    const { embedQuery, EmbeddingServiceError } = await loadEmbeddingClient();

    await expect(embedQuery('hi')).rejects.toThrow(
      'EMBEDDING_API_KEY is not configured',
    );
    await expect(embedQuery('hi')).rejects.toBeInstanceOf(EmbeddingServiceError);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
