import { jest } from '@jest/globals';
import { storeDocumentChunk } from '../../src/embeddings/vector-storage.js';
import { prisma } from '../../src/lib/prisma.js';
import { createTestInjury, deleteTestInjury } from './test-injury-fixuture.js';

jest.unstable_mockModule('../../src/embeddings/embedding-client.js', () => ({
  embedQuery: jest.fn(),
}));

jest.unstable_mockModule('../../src/llm/llm-client.js', () => ({
  generateAnswer: jest.fn(),
}));

const { answerQuestion } = await import('../../src/rag/rag-service.js');
const { embedQuery } = await import('../../src/embeddings/embedding-client.js');
const { generateAnswer } = await import('../../src/llm/llm-client.js');

const mockEmbedQuery = jest.mocked(embedQuery);
const mockGenerateAnswer = jest.mocked(generateAnswer);

function vectorWith(first: number, second = 0, third = 0): number[] {
  const vector = new Array<number>(1024).fill(0);

  vector[0] = first;
  vector[1] = second;
  vector[2] = third;

  return vector;
}

describe('RAG pipeline integration', () => {
  let injuryId: number;
  let userId: number;
  let treatmentId: number;

  beforeAll(async () => {
    const testInjury = await createTestInjury('RAG Pipeline Test');

    injuryId = testInjury.injuryId;
    userId = testInjury.userId;

    const treatment = await prisma.treatment.create({
      data: {
        name: 'Physiotherapy',
        date: new Date(),
        injuryId,
      },
    });

    treatmentId = treatment.id;

    await storeDocumentChunk(
      injuryId,
      userId,
      'treatment',
      treatmentId,
      0,
      'Physiotherapy helped improve my hip pain.',
      vectorWith(1, 0, 0),
      'test-model',
      'test-version',
    );

    await storeDocumentChunk(
      injuryId,
      userId,
      'treatment',
      treatmentId,
      1,
      'I also received physiotherapy exercises.',
      vectorWith(0.9, 0.1, 0),
      'test-model',
      'test-version',
    );
  });

  afterAll(async () => {
    await prisma.treatment.delete({ where: { id: treatmentId } });
    await deleteTestInjury(injuryId, userId);
    await prisma.$disconnect();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockEmbedQuery.mockResolvedValue({
      embedding: vectorWith(1, 0, 0),
      model: 'test-model',
      modelVersion: 'test-version',
      dimension: 1024,
      version: 'test',
    });

    mockGenerateAnswer.mockResolvedValue('mocked answer');
  });

  it('retrieves evidence and generates an answer through the RAG pipeline', async () => {
    const result = await answerQuestion(
      'What treatments did I have?',
      injuryId,
      userId,
      2,
    );

    expect(result.answer).toBe('mocked answer');

    expect(result.chunks.length).toBeGreaterThan(0);

    expect(result.chunks[0]).toMatchObject({
      sourceType: 'treatment',
      sourceId: treatmentId,
    });

    expect(result.citations).toHaveLength(1);

    expect(result.citations[0]).toMatchObject({
      sourceType: 'treatment',
      sourceId: treatmentId,
      label: `Treatment #${treatmentId}`,
    });

    expect(mockEmbedQuery).toHaveBeenCalledWith(
      'What treatments did I have?',
      undefined,
    );

    expect(mockGenerateAnswer).toHaveBeenCalledTimes(1);
  });

  it('routes an unscoped question to the matching injury and excludes unrelated injuries from citations (#209)', async () => {
    const otherInjury = await prisma.injury.create({
      data: {
        name: 'Unrelated shoulder injury',
        bodyArea: 'shoulder',
        startDate: new Date(),
        userId,
      },
    });

    try {
      // The injury's own summary chunk is what routing compares the
      // question against — put it close to the question embedding so this
      // injury is the one selected.
      await storeDocumentChunk(
        injuryId,
        userId,
        'injury',
        injuryId,
        0,
        'Injury: RAG Pipeline Test. Body area: hip.',
        vectorWith(1, 0, 0),
        'test-model',
        'test-version',
      );

      // The unrelated injury's chunks sit far away in embedding space so
      // they lose the routing step entirely.
      await storeDocumentChunk(
        otherInjury.id,
        userId,
        'treatment',
        1,
        0,
        'Physical therapy for the shoulder.',
        vectorWith(0, 1, 0),
        'test-model',
        'test-version',
      );

      const result = await answerQuestion(
        'What treatments did I have?',
        undefined,
        userId,
        5,
      );

      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.chunks.every((chunk) => chunk.injuryId === injuryId)).toBe(true);

      expect(result.citations.length).toBeGreaterThan(0);
      expect(result.citations.every((c) => c.injuryId !== otherInjury.id)).toBe(true);
    } finally {
      await prisma.documentChunk.deleteMany({ where: { injuryId: otherInjury.id } });
      await prisma.injury.delete({ where: { id: otherInjury.id } });
    }
  });

  it('blocks diagnosis requests before retrieval or LLM generation', async () => {
    const result = await answerQuestion('Do I have a fracture?', injuryId, userId);

    expect(result).toEqual({
      answer:
        'I cannot diagnose medical conditions or identify what condition you may have, but I can help summarize your recorded symptoms, tests, treatments, and medical history.',
      chunks: [],
      citations: [],
    });

    expect(mockEmbedQuery).not.toHaveBeenCalled();
    expect(mockGenerateAnswer).not.toHaveBeenCalled();
  });
});
