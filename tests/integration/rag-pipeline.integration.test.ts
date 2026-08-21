import { answerQuestion } from '../../src/rag/rag-service.js';
import { storeDocumentChunk } from '../../src/embeddings/vector-storage.js';
import { prisma } from '../../src/lib/prisma.js';
import { embedText } from '../../src/embeddings/embedding-client.js';
import { generateAnswer } from '../../src/llm/llm-client.js';

jest.mock('../../src/embeddings/embedding-client.js', () => ({
  embedText: jest.fn(),
}));

jest.mock('../../src/llm/llm-client.js', () => ({
  generateAnswer: jest.fn(),
}));

const mockEmbedText = jest.mocked(embedText);
const mockGenerateAnswer = jest.mocked(generateAnswer);

function vectorWith(first: number, second = 0, third = 0): number[] {
  const vector = new Array<number>(1024).fill(0);

  vector[0] = first;
  vector[1] = second;
  vector[2] = third;

  return vector;
}

describe('RAG pipeline integration', () => {
  beforeAll(async () => {
    await prisma.$executeRaw`
      DELETE FROM "DocumentChunk"
      WHERE "sourceType" = 'integration-test'
    `;

    await storeDocumentChunk(
      1,
      'integration-test',
      1,
      0,
      'Physiotherapy helped improve my hip pain.',
      vectorWith(1, 0, 0),
    );

    await storeDocumentChunk(
      1,
      'integration-test',
      1,
      1,
      'I also received physiotherapy exercises.',
      vectorWith(0.9, 0.1, 0),
    );
  });

  afterAll(async () => {
    await prisma.$executeRaw`
      DELETE FROM "DocumentChunk"
      WHERE "sourceType" = 'integration-test'
    `;

    await prisma.$disconnect();
  });

  beforeEach(() => {
    mockEmbedText.mockResolvedValue({
      embedding: vectorWith(1, 0, 0),
      model: 'test-model',
      modelVersion: 'test-version',
      dimension: 1024,
      version: 'test',
    });

    mockGenerateAnswer.mockResolvedValue('mocked answer');

    jest.clearAllMocks();
  });

  it('retrieves evidence and generates an answer through the RAG pipeline', async () => {
    const result = await answerQuestion('What treatments did I have?', 1, 2);

    expect(result.answer).toBe('mocked answer');

    expect(result.chunks.length).toBeGreaterThan(0);

    expect(result.chunks[0]).toMatchObject({
      sourceType: 'integration-test',
      sourceId: 1,
    });

    expect(result.citations).toHaveLength(1);

    expect(result.citations[0]).toMatchObject({
      sourceType: 'integration-test',
      sourceId: 1,
      label: 'Integration-test #1',
    });

    expect(mockEmbedText).toHaveBeenCalledWith('What treatments did I have?');

    expect(mockGenerateAnswer).toHaveBeenCalledTimes(1);
  });

  it('blocks diagnosis requests before retrieval or LLM generation', async () => {
    const result = await answerQuestion('Do I have a fracture?', 1);

    expect(result).toEqual({
      answer:
        'I cannot diagnose medical conditions, but I can help summarize your recorded symptoms, tests, treatments, and medical history.',
      chunks: [],
      citations: [],
    });

    expect(embedText).not.toHaveBeenCalled();
    expect(generateAnswer).not.toHaveBeenCalled();
  });
});
