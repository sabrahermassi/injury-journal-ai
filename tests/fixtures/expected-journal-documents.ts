import type { JournalDocument } from '../../src/ingestion/documents/document-types.js';

export const expectedJournalDocuments: JournalDocument[] = [
  // --------------------------------------------------
  // User 1 - Injury
  // --------------------------------------------------
  {
    content:
      'Injury: Lower back pain. Body area: Lower back. Side: Left. Started: 2025-01-01. Cause: Deadlift. Description: Started after heavy lifting. Status: Active.',
    metadata: {
      userId: 1,
      injuryId: 1,
      sourceType: 'injury',
      sourceId: 1,
      date: new Date('2025-01-01'),
    },
  },

  // User 1 - Symptoms
  {
    content:
      'On 2025-01-05, the user reported a symptom with a pain level of 7/10. Location: Lower back. Trigger: Prolonged standing. Duration: Several hours. Notes: Burning pain after standing for a long time.',
    metadata: {
      userId: 1,
      injuryId: 1,
      sourceType: 'symptom',
      sourceId: 1,
      date: new Date('2025-01-05'),
    },
  },
  {
    content:
      'On 2025-02-01, the user reported a symptom with a pain level of 5/10. Location: Lower back. Trigger: Morning movement. Duration: 30 minutes. Notes: Stiffness in the morning.',
    metadata: {
      userId: 1,
      injuryId: 1,
      sourceType: 'symptom',
      sourceId: 2,
      date: new Date('2025-02-01'),
    },
  },

  // User 1 - Treatments
  {
    content:
      'On 2025-01-10, the user received Physiotherapy. Provider: Rehab Center. Cost: 80. Reported outcome: Limited improvement.',
    metadata: {
      userId: 1,
      injuryId: 1,
      sourceType: 'treatment',
      sourceId: 1,
      date: new Date('2025-01-10'),
    },
  },
  {
    content:
      'On 2025-03-01, the user received Shockwave therapy. Provider: Rehab Center. Cost: 120. Reported outcome: No significant improvement.',
    metadata: {
      userId: 1,
      injuryId: 1,
      sourceType: 'treatment',
      sourceId: 2,
      date: new Date('2025-03-01'),
    },
  },

  // User 1 - Medical visit
  {
    content:
      'On 2025-01-15, the user had a medical visit. Doctor: Dr. Smith. Clinic: Rehab Center. Notes: Persistent lower back pain reported.',
    metadata: {
      userId: 1,
      injuryId: 1,
      sourceType: 'medical_visit',
      sourceId: 1,
      date: new Date('2025-01-15'),
    },
  },

  // User 1 - Timeline events
  {
    content:
      'On 2025-01-01, a timeline event occurred. Type: injury. Description: Injury started after deadlifting.',
    metadata: {
      userId: 1,
      injuryId: 1,
      sourceType: 'timeline_event',
      sourceId: 1,
      date: new Date('2025-01-01'),
    },
  },
  {
    content:
      'On 2025-03-01, a timeline event occurred. Type: treatment. Description: Received shockwave therapy. Result: No significant improvement.',
    metadata: {
      userId: 1,
      injuryId: 1,
      sourceType: 'timeline_event',
      sourceId: 2,
      date: new Date('2025-03-01'),
    },
  },

  // --------------------------------------------------
  // User 2 - Injury
  // --------------------------------------------------
  {
    content:
      'Injury: Right shoulder pain. Body area: Shoulder. Side: Right. Started: 2024-06-15. Cause: Weightlifting. Description: Shoulder pain after overhead pressing. Status: Active.',
    metadata: {
      userId: 2,
      injuryId: 2,
      sourceType: 'injury',
      sourceId: 2,
      date: new Date('2024-06-15'),
    },
  },

  // User 2 - Symptoms
  {
    content:
      'On 2024-06-16, the user reported a symptom with a pain level of 8/10. Location: Right shoulder. Trigger: Overhead pressing. Duration: Several minutes. Notes: Sharp pain when lifting the arm overhead.',
    metadata: {
      userId: 2,
      injuryId: 2,
      sourceType: 'symptom',
      sourceId: 3,
      date: new Date('2024-06-16'),
    },
  },
  {
    content:
      'On 2024-07-01, the user reported a symptom with a pain level of 6/10. Location: Right shoulder. Trigger: Lifting. Duration: One hour. Notes: Pain continues during upper-body exercises.',
    metadata: {
      userId: 2,
      injuryId: 2,
      sourceType: 'symptom',
      sourceId: 4,
      date: new Date('2024-07-01'),
    },
  },

  // User 2 - Treatment
  {
    content:
      'On 2024-07-01, the user received Physical therapy. Provider: Sports Clinic. Cost: 90. Reported outcome: Some improvement.',
    metadata: {
      userId: 2,
      injuryId: 2,
      sourceType: 'treatment',
      sourceId: 3,
      date: new Date('2024-07-01'),
    },
  },

  // User 2 - Medical visit
  {
    content:
      'On 2024-06-20, the user had a medical visit. Doctor: Dr. Johnson. Clinic: Sports Clinic. Notes: Possible shoulder irritation.',
    metadata: {
      userId: 2,
      injuryId: 2,
      sourceType: 'medical_visit',
      sourceId: 2,
      date: new Date('2024-06-20'),
    },
  },

  // User 2 - Timeline events
  {
    content:
      'On 2024-06-15, a timeline event occurred. Type: injury. Description: Pain started during overhead press.',
    metadata: {
      userId: 2,
      injuryId: 2,
      sourceType: 'timeline_event',
      sourceId: 3,
      date: new Date('2024-06-15'),
    },
  },
  {
    content:
      'On 2024-07-01, a timeline event occurred. Type: treatment. Description: Started physical therapy. Result: Some improvement.',
    metadata: {
      userId: 2,
      injuryId: 2,
      sourceType: 'timeline_event',
      sourceId: 4,
      date: new Date('2024-07-01'),
    },
  },

  // --------------------------------------------------
  // User 3 - Injury
  // --------------------------------------------------
  {
    content:
      'Injury: Right knee pain. Body area: Knee. Side: Right. Started: 2023-09-10. Cause: Running. Description: Knee pain after increasing running distance. Status: Resolved.',
    metadata: {
      userId: 3,
      injuryId: 3,
      sourceType: 'injury',
      sourceId: 3,
      date: new Date('2023-09-10'),
    },
  },

  // User 3 - Symptoms
  {
    content:
      'On 2023-09-11, the user reported a symptom with a pain level of 6/10. Location: Right knee. Trigger: Running. Duration: Two hours. Notes: Mild swelling after running.',
    metadata: {
      userId: 3,
      injuryId: 3,
      sourceType: 'symptom',
      sourceId: 5,
      date: new Date('2023-09-11'),
    },
  },
  {
    content:
      'On 2023-09-15, the user reported a symptom with a pain level of 5/10. Location: Right knee. Trigger: Walking downstairs. Duration: Several minutes. Notes: Pain when walking downstairs.',
    metadata: {
      userId: 3,
      injuryId: 3,
      sourceType: 'symptom',
      sourceId: 6,
      date: new Date('2023-09-15'),
    },
  },

  // User 3 - Treatment
  {
    content:
      'On 2023-09-20, the user received Rest. Provider: Self-managed. Cost: 0. Reported outcome: Symptoms improved significantly.',
    metadata: {
      userId: 3,
      injuryId: 3,
      sourceType: 'treatment',
      sourceId: 4,
      date: new Date('2023-09-20'),
    },
  },

  // User 3 - Medical visit
  {
    content:
      'On 2023-09-15, the user had a medical visit. Doctor: Dr. Williams. Clinic: Orthopedic Clinic. Notes: No serious structural injury found.',
    metadata: {
      userId: 3,
      injuryId: 3,
      sourceType: 'medical_visit',
      sourceId: 3,
      date: new Date('2023-09-15'),
    },
  },

  // User 3 - Timeline events
  {
    content:
      'On 2023-09-10, a timeline event occurred. Type: injury. Description: Knee pain began after increasing running distance.',
    metadata: {
      userId: 3,
      injuryId: 3,
      sourceType: 'timeline_event',
      sourceId: 5,
      date: new Date('2023-09-10'),
    },
  },
  {
    content:
      'On 2023-10-01, a timeline event occurred. Type: recovery. Description: Symptoms resolved after rest. Result: Resolved.',
    metadata: {
      userId: 3,
      injuryId: 3,
      sourceType: 'timeline_event',
      sourceId: 6,
      date: new Date('2023-10-01'),
    },
  },
];
