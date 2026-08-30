import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  if (process.env.DATABASE_ENV !== 'development') {
    throw new Error('Refusing to seed: DATABASE_ENV must be "development".');
  }

  if (process.env.SEED_DEV_CONFIRM !== 'true') {
    throw new Error(
      'Refusing to seed: set SEED_DEV_CONFIRM=true to confirm destructive development seeding.',
    );
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('Refusing to seed: DATABASE_URL is not set.');
  }

  const databaseName = new URL(databaseUrl).pathname.slice(1);

  if (databaseName !== 'injury-journal-ai-db') {
    throw new Error(`Refusing to seed: unexpected database "${databaseName}".`);
  }

  // Clean existing development data and reset autoincrement IDs so every seed run
  // produces the same deterministic IDs (plain deleteMany() leaves sequences advanced,
  // so re-seeding drifts the IDs that evaluation/ai-system/dataset.json hardcodes).
  await prisma.$executeRaw`TRUNCATE TABLE
    "DocumentChunk",
    "MedicalVisit",
    "Treatment",
    "Symptom",
    "TimelineEvent",
    "Injury",
    "User"
    RESTART IDENTITY CASCADE`;

  // -------------------------
  // User 1
  // -------------------------
  const passwordHash = await bcrypt.hash('test-password', 10);

  await prisma.user.create({
    data: {
      email: 'test-user-1@example.com',
      password: passwordHash,
      updatedAt: new Date(),

      Injury: {
        create: {
          name: 'Lower back pain',
          bodyArea: 'Lower back',
          side: 'Left',
          startDate: new Date('2025-01-01'),
          cause: 'Deadlift',
          description: 'Started after heavy lifting',
          status: 'Active',

          Symptom: {
            create: [
              {
                date: new Date('2025-01-05'),
                painLevel: 7,
                location: 'Lower back',
                trigger: 'Prolonged standing',
                duration: 'Several hours',
                notes: 'Burning pain after standing for a long time.',
              },
              {
                date: new Date('2025-02-01'),
                painLevel: 5,
                location: 'Lower back',
                trigger: 'Morning movement',
                duration: '30 minutes',
                notes: 'Stiffness in the morning.',
              },
            ],
          },

          Treatment: {
            create: [
              {
                name: 'Physiotherapy',
                provider: 'Rehab Center',
                date: new Date('2025-01-10'),
                cost: 80,
                outcome: 'Limited improvement',
              },
              {
                name: 'Shockwave therapy',
                provider: 'Rehab Center',
                date: new Date('2025-03-01'),
                cost: 120,
                outcome: 'No significant improvement',
              },
            ],
          },

          MedicalVisit: {
            create: [
              {
                doctor: 'Dr. Smith',
                clinic: 'Rehab Center',
                date: new Date('2025-01-15'),
                notes: 'Persistent lower back pain reported.',
              },
            ],
          },

          TimelineEvent: {
            create: [
              {
                type: 'injury',
                date: new Date('2025-01-01'),
                description: 'Injury started after deadlifting.',
                result: null,
              },
              {
                type: 'treatment',
                date: new Date('2025-03-01'),
                description: 'Received shockwave therapy.',
                result: 'No significant improvement',
              },
            ],
          },
        },
      },
    },
  });

  // -------------------------
  // User 2
  // -------------------------

  await prisma.user.create({
    data: {
      email: 'test-user-2@example.com',
      password: passwordHash,
      updatedAt: new Date(),

      Injury: {
        create: {
          name: 'Right shoulder pain',
          bodyArea: 'Shoulder',
          side: 'Right',
          startDate: new Date('2024-06-15'),
          cause: 'Weightlifting',
          description: 'Shoulder pain after overhead pressing',
          status: 'Active',

          Symptom: {
            create: [
              {
                date: new Date('2024-06-16'),
                painLevel: 8,
                location: 'Right shoulder',
                trigger: 'Overhead pressing',
                duration: 'Several minutes',
                notes: 'Sharp pain when lifting the arm overhead.',
              },
              {
                date: new Date('2024-07-01'),
                painLevel: 6,
                location: 'Right shoulder',
                trigger: 'Lifting',
                duration: 'One hour',
                notes: 'Pain continues during upper-body exercises.',
              },
            ],
          },

          Treatment: {
            create: [
              {
                name: 'Physical therapy',
                provider: 'Sports Clinic',
                date: new Date('2024-07-01'),
                cost: 90,
                outcome: 'Some improvement',
              },
            ],
          },

          MedicalVisit: {
            create: [
              {
                doctor: 'Dr. Johnson',
                clinic: 'Sports Clinic',
                date: new Date('2024-06-20'),
                notes: 'Possible shoulder irritation.',
              },
            ],
          },

          TimelineEvent: {
            create: [
              {
                type: 'injury',
                date: new Date('2024-06-15'),
                description: 'Pain started during overhead press.',
                result: null,
              },
              {
                type: 'treatment',
                date: new Date('2024-07-01'),
                description: 'Started physical therapy.',
                result: 'Some improvement',
              },
            ],
          },
        },
      },
    },
  });

  // -------------------------
  // User 3
  // -------------------------

  await prisma.user.create({
    data: {
      email: 'test-user-3@example.com',
      password: passwordHash,
      updatedAt: new Date(),

      Injury: {
        create: {
          name: 'Right knee pain',
          bodyArea: 'Knee',
          side: 'Right',
          startDate: new Date('2023-09-10'),
          cause: 'Running',
          description: 'Knee pain after increasing running distance',
          status: 'Resolved',

          Symptom: {
            create: [
              {
                date: new Date('2023-09-11'),
                painLevel: 6,
                location: 'Right knee',
                trigger: 'Running',
                duration: 'Two hours',
                notes: 'Mild swelling after running.',
              },
              {
                date: new Date('2023-09-15'),
                painLevel: 5,
                location: 'Right knee',
                trigger: 'Walking downstairs',
                duration: 'Several minutes',
                notes: 'Pain when walking downstairs.',
              },
            ],
          },

          Treatment: {
            create: [
              {
                name: 'Rest',
                provider: 'Self-managed',
                date: new Date('2023-09-20'),
                cost: 0,
                outcome: 'Symptoms improved significantly',
              },
            ],
          },

          MedicalVisit: {
            create: [
              {
                doctor: 'Dr. Williams',
                clinic: 'Orthopedic Clinic',
                date: new Date('2023-09-15'),
                notes: 'No serious structural injury found.',
              },
            ],
          },

          TimelineEvent: {
            create: [
              {
                type: 'injury',
                date: new Date('2023-09-10'),
                description:
                  'Knee pain began after increasing running distance.',
                result: null,
              },
              {
                type: 'recovery',
                date: new Date('2023-10-01'),
                description: 'Symptoms resolved after rest.',
                result: 'Resolved',
              },
            ],
          },
        },
      },
    },
  });

  // -------------------------
  // User 1 — second injury (#208 regression fixture)
  // -------------------------
  // Deliberately unrelated to "Lower back pain" above, so an unscoped RAG query for
  // this same user can retrieve chunks from both injuries and the eval harness can
  // exercise the cross-injury misattribution scenario from #208. Appended after all
  // other users so it doesn't shift the autoincrement IDs dataset.json already hardcodes.
  await prisma.injury.create({
    data: {
      userId: 1,
      name: 'Right knee pain',
      bodyArea: 'Knee',
      side: 'Right',
      startDate: new Date('2025-03-20'),
      cause: 'Running',
      description: 'Knee pain after increasing running distance',
      status: 'Active',

      Symptom: {
        create: [
          {
            date: new Date('2025-03-21'),
            painLevel: 4,
            location: 'Right knee',
            trigger: 'Running',
            duration: 'One hour',
            notes: 'Mild ache after running.',
          },
        ],
      },

      Treatment: {
        create: [
          {
            name: 'Foam rolling and rest',
            provider: 'Self-managed',
            date: new Date('2025-04-05'),
            cost: 0,
            outcome: 'Symptoms improved',
          },
        ],
      },

      TimelineEvent: {
        create: [
          {
            type: 'injury',
            date: new Date('2025-03-20'),
            description: 'Knee pain began after increasing running distance.',
            result: null,
          },
        ],
      },
    },
  });

  console.log('Development database seeded successfully.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
