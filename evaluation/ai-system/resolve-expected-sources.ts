import { prisma } from '../../src/lib/prisma.js';

export type ExpectedSourceFixture =
  | { sourceType: 'treatment'; injuryId: number; match: string }
  | { sourceType: 'symptom'; injuryId: number; match: string }
  | { sourceType: 'medical_visit'; injuryId: number; match: string }
  | { sourceType: 'injury'; match: string };

// take: 2 is enough to detect "more than one match" without fetching every match.
async function findMatches(
  fixture: ExpectedSourceFixture,
  userId: number,
): Promise<Array<{ id: number }>> {
  switch (fixture.sourceType) {
    case 'treatment':
      return prisma.treatment.findMany({
        where: { injuryId: fixture.injuryId, name: fixture.match },
        select: { id: true },
        take: 2,
      });
    case 'symptom':
      return prisma.symptom.findMany({
        where: { injuryId: fixture.injuryId, notes: fixture.match },
        select: { id: true },
        take: 2,
      });
    case 'medical_visit':
      return prisma.medicalVisit.findMany({
        where: { injuryId: fixture.injuryId, doctor: fixture.match },
        select: { id: true },
        take: 2,
      });
    case 'injury':
      return prisma.injury.findMany({
        where: { userId, name: fixture.match },
        select: { id: true },
        take: 2,
      });
  }
}

// Eval dataset cases describe expected retrieval sources by name (e.g. a
// treatment's name) instead of a hardcoded Prisma autoincrement ID, since
// that ID drifts silently whenever prisma/seed-dev.ts fixtures change. This
// resolves each description to the real current ID right before scoring, so
// a fixture that no longer exists — or now matches more than one record —
// fails loudly instead of comparing against the wrong one.
export async function resolveExpectedSources(
  fixtures: ExpectedSourceFixture[],
  userId: number,
  caseId: string,
): Promise<Array<{ sourceType: string; sourceId: number }>> {
  return Promise.all(
    fixtures.map(async (fixture) => {
      const matches = await findMatches(fixture, userId);
      const scope =
        fixture.sourceType === 'injury'
          ? `for user ${userId}`
          : `in injury ${fixture.injuryId}`;

      if (matches.length === 0) {
        throw new Error(
          `Eval case "${caseId}": no ${fixture.sourceType} matching "${fixture.match}" found ${scope}. ` +
            'Check prisma/seed-dev.ts fixtures.',
        );
      }

      if (matches.length > 1) {
        throw new Error(
          `Eval case "${caseId}": more than one ${fixture.sourceType} matches "${fixture.match}" ${scope} ` +
            '— the fixture description is no longer unique. Check prisma/seed-dev.ts fixtures.',
        );
      }

      return { sourceType: fixture.sourceType, sourceId: matches[0].id };
    }),
  );
}
