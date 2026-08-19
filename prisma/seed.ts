import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('test')) {
    throw new Error(
      'Refusing to seed: DATABASE_URL does not point at a test database.',
    );
  }

  // Clean existing test data
  await prisma.documentChunk.deleteMany();
  await prisma.medicalVisit.deleteMany();
  await prisma.treatment.deleteMany();
  await prisma.symptom.deleteMany();
  await prisma.timelineEvent.deleteMany();
  await prisma.injury.deleteMany();
  await prisma.user.deleteMany();

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

  console.log('Test database seeded successfully.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
