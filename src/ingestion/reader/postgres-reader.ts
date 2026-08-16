import { prisma } from '../../lib/prisma.js';

export async function readJournalData() {
  const injuries = await prisma.injury.findMany({
    include: {
      Symptom: true,
      Treatment: true,
      MedicalVisit: true,
      TimelineEvent: true,
    },
  });

  return injuries;
}
