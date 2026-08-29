export class EmbeddingServiceError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'EmbeddingServiceError';
  }
}

const EMBEDDING_API_URL =
  process.env.EMBEDDING_API_URL ?? 'http://127.0.0.1:8000';

const DEFAULT_EMBEDDING_API_TIMEOUT_MS = 30_000;

const configuredTimeout = Number(process.env.EMBEDDING_API_TIMEOUT_MS);

const EMBEDDING_API_TIMEOUT_MS =
  Number.isFinite(configuredTimeout) && configuredTimeout > 0
    ? configuredTimeout
    : DEFAULT_EMBEDDING_API_TIMEOUT_MS;

type EmbeddingResponse = {
  embedding: number[];
  model: string;
  modelVersion: string;
  dimension: number;
  version: string;
};

function validateEmbeddingResponse(data: unknown): EmbeddingResponse {
  if (typeof data !== 'object' || data === null) {
    throw new EmbeddingServiceError('Embedding API returned an invalid response');
  }

  const response = data as Record<string, unknown>;

  if (
    typeof response.model !== 'string' ||
    typeof response.modelVersion !== 'string' ||
    typeof response.version !== 'string' ||
    typeof response.dimension !== 'number' ||
    !Array.isArray(response.embedding)
  ) {
    throw new EmbeddingServiceError('Embedding API returned an invalid response');
  }

  if (
    response.embedding.length !== 1024 ||
    response.dimension !== response.embedding.length ||
    !response.embedding.every(
      (value) => typeof value === 'number' && Number.isFinite(value),
    )
  ) {
    throw new EmbeddingServiceError('Embedding API returned an invalid embedding');
  }

  return {
    embedding: response.embedding,
    model: response.model,
    modelVersion: response.modelVersion,
    dimension: response.dimension,
    version: response.version,
  };
}

/**
 * Posts text to the embedding API at the specified path and returns the validated response.
 * @param path - The API endpoint path (e.g., '/embed', '/embed-query')
 * @param text - The text to embed
 * @returns The validated embedding response with vector, model metadata, and dimensions
 * @throws {Error} If the request fails, times out, or returns invalid data
 */
async function postEmbedding(
  path: string,
  text: string,
): Promise<EmbeddingResponse> {
  const apiKey = process.env.EMBEDDING_API_KEY;

  if (!apiKey) {
    throw new EmbeddingServiceError('EMBEDDING_API_KEY is not configured');
  }

  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    EMBEDDING_API_TIMEOUT_MS,
  );

  try {
    let response: Response;

    try {
      response = await fetch(`${EMBEDDING_API_URL}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      throw new EmbeddingServiceError(message, { cause: error });
    }

    if (!response.ok) {
      throw new EmbeddingServiceError(
        `Embedding API request failed: ${response.status} ${response.statusText}`,
      );
    }

    let data: unknown;

    try {
      data = await response.json();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      throw new EmbeddingServiceError(
        `Embedding API returned a malformed response: ${message}`,
        { cause: error },
      );
    }

    return validateEmbeddingResponse(data);
  } finally {
    clearTimeout(timeout);
  }
}

export async function embedText(text: string): Promise<EmbeddingResponse> {
  return postEmbedding('/embed', text);
}

/**
 * Embeds a search query using the query-optimized embedding endpoint.
 * Uses the embedding service's query-specific encoding for retrieval tasks.
 * @param text - The query text to embed
 * @returns The embedding response with 1024-dimensional vector
 */
export async function embedQuery(
  text: string,
  requestId?: string,
): Promise<EmbeddingResponse> {
  void requestId; // unused for now — reserved for future log correlation (#32)

  return postEmbedding('/embed-query', text);
}
