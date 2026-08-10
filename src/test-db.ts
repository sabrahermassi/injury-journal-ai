import { prisma } from './lib/prisma';

async function main() {
  const injuries = await prisma.injury.findMany();

  console.log(injuries);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
