import type { JournalDocument } from './document-types.js';

export interface InjuryWithRelations {
  id: number;
  name: string;
  bodyArea: string;
  side: string | null;
  startDate: Date;
  cause: string | null;
  description: string | null;
  status: string | null;
  userId: number;
  Symptom: {
    id: number;
    date: Date;
    painLevel: number;
    location: string | null;
    trigger: string | null;
    duration: string | null;
    notes: string | null;
  }[];
  Treatment: {
    id: number;
    name: string;
    provider: string | null;
    date: Date;
    cost: number | null;
    outcome: string | null;
  }[];
  MedicalVisit: {
    id: number;
    doctor: string | null;
    clinic: string | null;
    date: Date;
    notes: string | null;
  }[];
  TimelineEvent: {
    id: number;
    type: string;
    date: Date;
    description: string;
    result: string | null;
  }[];
}

export function buildJournalDocuments(
  injuries: InjuryWithRelations[],
): JournalDocument[] {
  const documents: JournalDocument[] = [];

  for (const injury of injuries) {
    documents.push({
      content: buildInjuryDocument(injury),
      metadata: {
        userId: injury.userId,
        injuryId: injury.id,
        sourceType: 'injury',
        sourceId: injury.id,
        date: injury.startDate,
      },
    });

    for (const symptom of injury.Symptom) {
      documents.push({
        content: buildSymptomDocument(symptom),
        metadata: {
          userId: injury.userId,
          injuryId: injury.id,
          sourceType: 'symptom',
          sourceId: symptom.id,
          date: symptom.date,
        },
      });
    }

    for (const treatment of injury.Treatment) {
      documents.push({
        content: buildTreatmentDocument(treatment),
        metadata: {
          userId: injury.userId,
          injuryId: injury.id,
          sourceType: 'treatment',
          sourceId: treatment.id,
          date: treatment.date,
        },
      });
    }

    for (const visit of injury.MedicalVisit) {
      documents.push({
        content: buildMedicalVisitDocument(visit),
        metadata: {
          userId: injury.userId,
          injuryId: injury.id,
          sourceType: 'medical_visit',
          sourceId: visit.id,
          date: visit.date,
        },
      });
    }

    for (const event of injury.TimelineEvent) {
      documents.push({
        content: buildTimelineEventDocument(event),
        metadata: {
          userId: injury.userId,
          injuryId: injury.id,
          sourceType: 'timeline_event',
          sourceId: event.id,
          date: event.date,
        },
      });
    }
  }

  return documents;
}

function buildInjuryDocument(injury: InjuryWithRelations): string {
  const parts = [`Injury: ${injury.name}.`, `Body area: ${injury.bodyArea}.`];

  if (injury.side) {
    parts.push(`Side: ${injury.side}.`);
  }

  parts.push(`Started: ${injury.startDate.toISOString().split('T')[0]}.`);

  if (injury.cause) {
    parts.push(`Cause: ${injury.cause}.`);
  }

  if (injury.description) {
    parts.push(`Description: ${injury.description}.`);
  }

  if (injury.status) {
    parts.push(`Status: ${injury.status}.`);
  }

  return parts.join(' ');
}

function buildSymptomDocument(
  symptom: InjuryWithRelations['Symptom'][number],
): string {
  const parts = [
    `On ${formatDate(symptom.date)}, the user reported a symptom`,
    `with a pain level of ${symptom.painLevel}/10.`,
  ];

  if (symptom.location) {
    parts.push(`Location: ${symptom.location}.`);
  }

  if (symptom.trigger) {
    parts.push(`Trigger: ${symptom.trigger}.`);
  }

  if (symptom.duration) {
    parts.push(`Duration: ${symptom.duration}.`);
  }

  if (symptom.notes) {
    parts.push(`Notes: ${symptom.notes}.`);
  }

  return parts.join(' ');
}

function buildTreatmentDocument(
  treatment: InjuryWithRelations['Treatment'][number],
): string {
  const parts = [
    `On ${formatDate(treatment.date)}, the user received ${treatment.name}.`,
  ];

  if (treatment.provider) {
    parts.push(`Provider: ${treatment.provider}.`);
  }

  if (treatment.cost !== null) {
    parts.push(`Cost: ${treatment.cost}.`);
  }

  if (treatment.outcome) {
    parts.push(`Reported outcome: ${treatment.outcome}.`);
  }

  return parts.join(' ');
}

// document-chunker.ts's splitIntoFields pattern-matches "Doctor:"/"Clinic:"/
// "Notes:" (and the other capitalized-label prefixes below and in the other
// build*Document functions) as field-split boundaries. Changing a label's
// wording or casing won't break anything, but it will silently stop that
// field from being a chunk-split boundary — check document-chunker.ts if
// that matters.
function buildMedicalVisitDocument(
  visit: InjuryWithRelations['MedicalVisit'][number],
): string {
  const parts = [`On ${formatDate(visit.date)}, the user had a medical visit.`];

  if (visit.doctor) {
    parts.push(`Doctor: ${visit.doctor}.`);
  }

  if (visit.clinic) {
    parts.push(`Clinic: ${visit.clinic}.`);
  }

  if (visit.notes) {
    parts.push(`Notes: ${visit.notes}.`);
  }

  return parts.join(' ');
}

function buildTimelineEventDocument(
  event: InjuryWithRelations['TimelineEvent'][number],
): string {
  const parts = [
    `On ${formatDate(event.date)}, a timeline event occurred.`,
    `Type: ${event.type}.`,
    `Description: ${event.description}.`,
  ];

  if (event.result) {
    parts.push(`Result: ${event.result}.`);
  }

  return parts.join(' ');
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
