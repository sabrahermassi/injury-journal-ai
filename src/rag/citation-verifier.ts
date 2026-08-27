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

    verifiedCitations.push({
      ...citation,
      verified: exists,
    });
  }

  return verifiedCitations;
}
