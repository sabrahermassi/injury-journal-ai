import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Clean existing test data
  await prisma.medicalVisit.deleteMany();
  await prisma.treatment.deleteMany();
  await prisma.symptom.deleteMany();
  await prisma.timelineEvent.deleteMany();
  await prisma.injury.deleteMany();
  await prisma.user.deleteMany();

  // -------------------------
  // User 1
  // -------------------------

  await prisma.user.create({
    data: {
      id: 1,
      email: 'test-user-1@example.com',
      password: 'test-password',
      updatedAt: new Date(),

      Injury: {
        create: {
          id: 1,
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
                id: 1,
                date: new Date('2025-01-05'),
                painLevel: 7,
                location: 'Lower back',
                trigger: 'Prolonged standing',
                duration: 'Several hours',
                notes: 'Burning pain after standing for a long time.',
              },
              {
                id: 2,
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
                id: 1,
                name: 'Physiotherapy',
                provider: 'Rehab Center',
                date: new Date('2025-01-10'),
                cost: 80,
                outcome: 'Limited improvement',
              },
              {
                id: 2,
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
                id: 1,
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
                id: 1,
                type: 'injury',
                date: new Date('2025-01-01'),
                description: 'Injury started after deadlifting.',
                result: null,
              },
              {
                id: 2,
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
      id: 2,
      email: 'test-user-2@example.com',
      password: 'test-password',
      updatedAt: new Date(),

      Injury: {
        create: {
          id: 2,
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
                id: 3,
                date: new Date('2024-06-16'),
                painLevel: 8,
                location: 'Right shoulder',
                trigger: 'Overhead pressing',
                duration: 'Several minutes',
                notes: 'Sharp pain when lifting the arm overhead.',
              },
              {
                id: 4,
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
                id: 3,
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
                id: 2,
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
                id: 3,
                type: 'injury',
                date: new Date('2024-06-15'),
                description: 'Pain started during overhead press.',
                result: null,
              },
              {
                id: 4,
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
      id: 3,
      email: 'test-user-3@example.com',
      password: 'test-password',
      updatedAt: new Date(),

      Injury: {
        create: {
          id: 3,
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
                id: 5,
                date: new Date('2023-09-11'),
                painLevel: 6,
                location: 'Right knee',
                trigger: 'Running',
                duration: 'Two hours',
                notes: 'Mild swelling after running.',
              },
              {
                id: 6,
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
                id: 4,
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
                id: 3,
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
                id: 5,
                type: 'injury',
                date: new Date('2023-09-10'),
                description:
                  'Knee pain began after increasing running distance.',
                result: null,
              },
              {
                id: 6,
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
