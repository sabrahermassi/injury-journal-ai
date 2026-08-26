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

  beforeAll(async () => {
    const testInjury = await createTestInjury('RAG Pipeline Test');

    injuryId = testInjury.injuryId;
    userId = testInjury.userId;

    await storeDocumentChunk(
      injuryId,
      'rag-pipeline-integration-test',
      1,
      0,
      'Physiotherapy helped improve my hip pain.',
      vectorWith(1, 0, 0),
    );

    await storeDocumentChunk(
      injuryId,
      'rag-pipeline-integration-test',
      1,
      1,
      'I also received physiotherapy exercises.',
      vectorWith(0.9, 0.1, 0),
    );
  });

  afterAll(async () => {
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
      2,
    );

    expect(result.answer).toBe('mocked answer');

    expect(result.chunks.length).toBeGreaterThan(0);

    expect(result.chunks[0]).toMatchObject({
      sourceType: 'rag-pipeline-integration-test',
      sourceId: 1,
    });

    expect(result.citations).toHaveLength(1);

    expect(result.citations[0]).toMatchObject({
      sourceType: 'rag-pipeline-integration-test',
      sourceId: 1,
      label: 'Rag-pipeline-integration-test #1',
    });

    expect(mockEmbedQuery).toHaveBeenCalledWith('What treatments did I have?');

    expect(mockGenerateAnswer).toHaveBeenCalledTimes(1);
  });

  it('blocks diagnosis requests before retrieval or LLM generation', async () => {
    const result = await answerQuestion('Do I have a fracture?', injuryId);

    expect(result).toEqual({
      answer:
        'I cannot diagnose medical conditions, but I can help summarize your recorded symptoms, tests, treatments, and medical history.',
      chunks: [],
      citations: [],
    });

    expect(mockEmbedQuery).not.toHaveBeenCalled();
    expect(mockGenerateAnswer).not.toHaveBeenCalled();
  });
});
