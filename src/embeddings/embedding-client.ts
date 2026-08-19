const EMBEDDING_API_URL =
  process.env.EMBEDDING_API_URL ?? 'http://127.0.0.1:8000';

const EMBEDDING_API_TIMEOUT_MS = Number(
  process.env.EMBEDDING_API_TIMEOUT_MS ?? 30_000,
);

type EmbeddingResponse = {
  embedding: number[];
  model: string;
  modelVersion: string;
  dimension: number;
  version: string;
};

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

    const data = (await response.json()) as EmbeddingResponse;

    return data;
  } finally {
    clearTimeout(timeout);
  }
}
