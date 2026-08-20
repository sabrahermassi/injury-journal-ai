import { embedText } from '../embeddings/embedding-client.js';
import { searchSimilarChunks } from '../embeddings/vector-storage.js';

export async function semanticSearch(
  query: string,
  limit = 5,
  injuryId?: number,
) {
  const result = await embedText(query);

  return searchSimilarChunks(result.embedding, limit, injuryId);
}
