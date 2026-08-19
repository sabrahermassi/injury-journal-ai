import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function mapCitationSources(citations: any[]) {
  const results = [];

  for (const citation of citations) {
    if (citation.sourceType === 'treatment') {
      const treatment = await prisma.treatment.findUnique({
        where: {
          id: citation.sourceId,
        },
      });

      if (treatment) {
        results.push({
          sourceId: treatment.id,
          type: 'Treatment',
          title: treatment.name,
          date: treatment.date,
        });
      }
    }

    if (citation.sourceType === 'medical_visit') {
      const visit = await prisma.medicalVisit.findUnique({
        where: {
          id: citation.sourceId,
        },
      });

      if (visit) {
        results.push({
          sourceId: visit.id,
          type: 'Medical Visit',
          title: visit.doctor ? `Visit with ${visit.doctor}` : 'Medical Visit',
          date: visit.date,
        });
      }
    }
  }

  return results;
}
