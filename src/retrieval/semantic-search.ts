import { embedQuery } from '../embeddings/embedding-client.js';
import { searchSimilarChunks } from '../embeddings/vector-storage.js';

export async function semanticSearch(
  query: string,
  injuryId?: number,
  limit = 5,
  requestId?: string,
) {
  const result = await embedQuery(query, requestId);

  return searchSimilarChunks(result.embedding, injuryId, limit, undefined, undefined, requestId);
}
