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
    throw new Error('Embedding API returned an invalid response');
  }

  const response = data as Record<string, unknown>;

  if (
    typeof response.model !== 'string' ||
    typeof response.modelVersion !== 'string' ||
    typeof response.version !== 'string' ||
    typeof response.dimension !== 'number' ||
    !Array.isArray(response.embedding)
  ) {
    throw new Error('Embedding API returned an invalid response');
  }

  if (
    response.embedding.length !== 1024 ||
    response.dimension !== response.embedding.length ||
    !response.embedding.every(
      (value) => typeof value === 'number' && Number.isFinite(value),
    )
  ) {
    throw new Error('Embedding API returned an invalid embedding');
  }

  return {
    embedding: response.embedding,
    model: response.model,
    modelVersion: response.modelVersion,
    dimension: response.dimension,
    version: response.version,
  };
}

export async function embedText(text: string): Promise<EmbeddingResponse> {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    EMBEDDING_API_TIMEOUT_MS,
  );

  try {
    const response = await fetch(`${EMBEDDING_API_URL}/embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Embedding API request failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();

    return validateEmbeddingResponse(data);
  } finally {
    clearTimeout(timeout);
  }
}
