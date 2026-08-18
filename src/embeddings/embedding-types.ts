import type { JournalDocument } from '../ingestion/documents/document-types.js';

export interface EmbeddedDocument {
  document: JournalDocument;
  embedding: number[];

  embeddingMetadata: {
    model: string;
    modelVersion: string;
    vectorDimension: number;
    embeddingVersion: string;
  };
}
