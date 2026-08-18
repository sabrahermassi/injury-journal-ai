const EMBEDDING_API_URL =
  process.env.EMBEDDING_API_URL ?? 'http://127.0.0.1:8000';

type EmbeddingResponse = {
  embedding: number[];
  model: string;
  dimension: number;
  version: string;
};

export async function embedText(text: string): Promise<EmbeddingResponse> {
  const response = await fetch(`${EMBEDDING_API_URL}/embed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(
      `Embedding API failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.json() as Promise<EmbeddingResponse>;
}
