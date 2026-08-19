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
    json: async () => ({}),
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

    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(
      makeResponse({
        json: async () => ({
          embedding: [0.1, 0.2, 0.3],
          model: 'Qwen/Qwen3-Embedding-0.6B',
          modelVersion: 'abc123',
          dimension: 3,
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'hello world' }),
      }),
    );
    expect(result).toEqual({
      embedding: [0.1, 0.2, 0.3],
      model: 'Qwen/Qwen3-Embedding-0.6B',
      modelVersion: 'abc123',
      dimension: 3,
      version: 'qwen3-embedding-0.6b-v1',
    });
  });

  it('uses a custom EMBEDDING_API_URL when configured', async () => {
    process.env.EMBEDDING_API_URL = 'http://embedding-service:9000';

    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(
      makeResponse({
        json: async () => ({
          embedding: [],
          model: '',
          modelVersion: '',
          dimension: 0,
          version: '',
        }),
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const { embedText } = await loadEmbeddingClient();
    await embedText('hi');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://embedding-service:9000/embed',
      expect.anything(),
    );
  });

  it('passes an AbortSignal to fetch', async () => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(
      makeResponse({
        json: async () => ({
          embedding: [],
          model: '',
          modelVersion: '',
          dimension: 0,
          version: '',
        }),
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const { embedText } = await loadEmbeddingClient();
    await embedText('hi');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('throws a descriptive error when the response is not ok', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        makeResponse({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        }),
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    const { embedText } = await loadEmbeddingClient();

    await expect(embedText('hi')).rejects.toThrow(
      'Embedding API request failed: 500 Internal Server Error',
    );
  });

  it('propagates network errors thrown by fetch', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('network down'));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { embedText } = await loadEmbeddingClient();

    await expect(embedText('hi')).rejects.toThrow('network down');
  });

  it('clears the timeout after a successful request', async () => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(
      makeResponse({
        json: async () => ({
          embedding: [1],
          model: 'm',
          modelVersion: 'v',
          dimension: 1,
          version: 'v1',
        }),
      }),
    );
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

    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(
      makeResponse({
        json: async () => ({
          embedding: [],
          model: '',
          modelVersion: '',
          dimension: 0,
          version: '',
        }),
      }),
    );
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

      const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(
        makeResponse({
          json: async () => ({
            embedding: [],
            model: '',
            modelVersion: '',
            dimension: 0,
            version: '',
          }),
        }),
      );
      global.fetch = fetchMock as unknown as typeof fetch;
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      const { embedText } = await loadEmbeddingClient();
      await embedText('hi');

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 30000);
    },
  );

  it('uses a valid custom EMBEDDING_API_TIMEOUT_MS when provided', async () => {
    process.env.EMBEDDING_API_TIMEOUT_MS = '5000';

    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(
      makeResponse({
        json: async () => ({
          embedding: [],
          model: '',
          modelVersion: '',
          dimension: 0,
          version: '',
        }),
      }),
    );
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

    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(
      makeResponse({
        json: async () => ({
          embedding: [0.5],
          model: 'm',
          modelVersion: 'v',
          dimension: 1,
          version: 'v1',
        }),
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const { embedText } = await loadEmbeddingClient();

    const result = await embedText('hi');

    expect(result.embedding).toEqual([0.5]);
  });
});
