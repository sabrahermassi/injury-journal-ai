import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function journalTool(injuryId: number) {
  const injury = await prisma.injury.findUnique({
    where: {
      id: injuryId,
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
