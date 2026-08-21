import { prisma } from '../../src/lib/prisma.js';

export async function createTestInjury(name: string) {
  const user = await prisma.user.create({
    data: {
      email: `${name}-${Date.now()}@test.com`,
      password: 'test-password',
      updatedAt: new Date(),
    },
  });

  const injury = await prisma.injury.create({
    data: {
      name,
      bodyArea: 'hip',
      startDate: new Date(),
      userId: user.id,
    },
  });

  return {
    userId: user.id,
    injuryId: injury.id,
  };
}

export async function deleteTestInjury(injuryId: number, userId: number) {
  await prisma.documentChunk.deleteMany({
    where: { injuryId },
  });

  await prisma.injury.delete({
    where: { id: injuryId },
  });

  await prisma.user.delete({
    where: { id: userId },
  });
}
