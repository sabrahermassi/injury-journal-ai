import type { JournalDocument } from './documents/document-types.js';
import { chunkDocument } from './chunking/document-chunker.js';
import { embedText } from '../embeddings/embedding-client.js';
import {
  storeDocumentChunk,
  deleteDocumentChunksExcept,
} from '../embeddings/vector-storage.js';
import type { EmbeddedDocument } from '../embeddings/embedding-types.js';

export async function embedAndStoreDocument(
  document: JournalDocument,
): Promise<void> {
  const chunks = chunkDocument(document);

  for (const [chunkIndex, chunk] of chunks.entries()) {
    const embedding = await embedText(chunk.content);

    const embeddedDocument: EmbeddedDocument = {
      document: chunk,
      embedding: embedding.embedding,
      embeddingMetadata: {
        model: embedding.model,
        modelVersion: embedding.modelVersion,
        vectorDimension: embedding.dimension,
        embeddingVersion: embedding.version,
      },
    };

    await storeDocumentChunk(
      embeddedDocument.document.metadata.injuryId,
      embeddedDocument.document.metadata.sourceType,
      embeddedDocument.document.metadata.sourceId,
      chunkIndex,
      embeddedDocument.document.content,
      embeddedDocument.embedding,
      {
        ...embeddedDocument.document.metadata,
        embedding: embeddedDocument.embeddingMetadata,
      },
    );
  }

  await deleteDocumentChunksExcept(
    document.metadata.sourceType,
    document.metadata.sourceId,
    chunks.map((_, index) => index),
  );
}
