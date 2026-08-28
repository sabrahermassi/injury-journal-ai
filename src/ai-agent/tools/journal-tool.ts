import { prisma } from '../../lib/prisma.js';

export async function journalTool(
  injuryId: number,
  userId: number,
  requestId?: string,
) {
  void requestId; // unused for now — reserved for future log correlation (#32)

  const injury = await prisma.injury.findFirst({
    where: {
      id: injuryId,
      userId,
    },
    include: {
      Treatment: true,
      Symptom: true,
      TimelineEvent: true,
      MedicalVisit: true,
    },
  });

  return injury;
}

type InjuryRecord = NonNullable<Awaited<ReturnType<typeof journalTool>>>;

export function formatInjuryRecord(injury: InjuryRecord, requestId?: string): string {
  void requestId; // unused for now — reserved for future log correlation (#32)

  const sections: string[] = [];

  const details = [
    `Name: ${injury.name}`,
    `Body area: ${injury.bodyArea}${injury.side ? ` (${injury.side})` : ''}`,
    `Start date: ${injury.startDate.toISOString().slice(0, 10)}`,
  ];

  if (injury.cause) details.push(`Cause: ${injury.cause}`);
  if (injury.status) details.push(`Status: ${injury.status}`);
  if (injury.description) details.push(`Description: ${injury.description}`);

  sections.push(`Injury:\n${details.join('\n')}`);

  if (injury.Symptom.length > 0) {
    const symptoms = injury.Symptom.map(
      (symptom) =>
        `- ${symptom.date.toISOString().slice(0, 10)}: pain level ${symptom.painLevel}${symptom.location ? ` at ${symptom.location}` : ''}${symptom.notes ? ` — ${symptom.notes}` : ''}`,
    ).join('\n');
    sections.push(`Symptoms:\n${symptoms}`);
  }

  if (injury.Treatment.length > 0) {
    const treatments = injury.Treatment.map(
      (treatment) =>
        `- ${treatment.date.toISOString().slice(0, 10)}: ${treatment.name}${treatment.provider ? ` (${treatment.provider})` : ''}${treatment.outcome ? ` — outcome: ${treatment.outcome}` : ''}`,
    ).join('\n');
    sections.push(`Treatments:\n${treatments}`);
  }

  if (injury.TimelineEvent.length > 0) {
    const events = injury.TimelineEvent.map(
      (event) =>
        `- ${event.date.toISOString().slice(0, 10)}: ${event.type} — ${event.description}${event.result ? ` (${event.result})` : ''}`,
    ).join('\n');
    sections.push(`Timeline events:\n${events}`);
  }

  if (injury.MedicalVisit.length > 0) {
    const visits = injury.MedicalVisit.map(
      (visit) =>
        `- ${visit.date.toISOString().slice(0, 10)}${visit.doctor ? `: ${visit.doctor}` : ''}${visit.clinic ? ` at ${visit.clinic}` : ''}${visit.notes ? ` — ${visit.notes}` : ''}`,
    ).join('\n');
    sections.push(`Medical visits:\n${visits}`);
  }

  return sections.join('\n\n');
}
