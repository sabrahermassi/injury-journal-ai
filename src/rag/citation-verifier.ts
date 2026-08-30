import { prisma } from '../lib/prisma.js';

export async function verifyCitations(
  citations: Array<{
    sourceType: string;
    sourceId: number;
    injuryId: number;
  }>,
) {
  const verifiedCitations = [];

  for (const citation of citations) {
    let exists = false;

    if (citation.sourceType === 'treatment') {
      const treatment = await prisma.treatment.findFirst({
        where: {
          id: citation.sourceId,
          injuryId: citation.injuryId,
        },
      });

      exists = Boolean(treatment);
    }

    if (citation.sourceType === 'medical_visit') {
      const visit = await prisma.medicalVisit.findFirst({
        where: {
          id: citation.sourceId,
          injuryId: citation.injuryId,
        },
      });

      exists = Boolean(visit);
    }

    if (citation.sourceType === 'symptom') {
      const symptom = await prisma.symptom.findFirst({
        where: {
          id: citation.sourceId,
          injuryId: citation.injuryId,
        },
      });

      exists = Boolean(symptom);
    }

    if (citation.sourceType === 'timeline_event') {
      const timelineEvent = await prisma.timelineEvent.findFirst({
        where: {
          id: citation.sourceId,
          injuryId: citation.injuryId,
        },
      });

      exists = Boolean(timelineEvent);
    }

    // An injury is its own source: document-builder.ts sets sourceId === injuryId
    // for injury-type citations, since Injury has no injuryId column of its own.
    if (citation.sourceType === 'injury') {
      if (citation.sourceId === citation.injuryId) {
        const injury = await prisma.injury.findFirst({
          where: {
            id: citation.sourceId,
          },
        });

        exists = Boolean(injury);
      }
    }

    verifiedCitations.push({
      ...citation,
      verified: exists,
    });
  }

  return verifiedCitations;
}
