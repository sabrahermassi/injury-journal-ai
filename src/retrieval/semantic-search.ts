import { embedText } from '../embeddings/embedding-client.js';
import { searchSimilarChunks } from '../embeddings/vector-storage.js';

export async function semanticSearch(
  query: string,
  injuryId?: number,
  limit = 5,
) {
  const result = await embedText(query);

  return searchSimilarChunks(result.embedding, injuryId, limit);
}
