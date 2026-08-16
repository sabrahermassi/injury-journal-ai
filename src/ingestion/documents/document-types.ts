export type DocumentSourceType =
  'injury' | 'symptom' | 'treatment' | 'medical_visit' | 'timeline_event';

export interface JournalDocument {
  content: string;

  metadata: {
    userId: number;
    injuryId: number;
    sourceType: DocumentSourceType;
    sourceId: number;
    date: Date;
  };
}
