import request from 'supertest';
import app from '../../src/app.js';
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

describe('RAG route integration', () => {
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
  });

  afterAll(async () => {
    await prisma.$executeRaw`
      DELETE FROM "DocumentChunk"
      WHERE "sourceType" = 'integration-test'
    `;

    await prisma.$disconnect();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockEmbedText.mockResolvedValue({
      embedding: vectorWith(1, 0, 0),
      model: 'test-model',
      modelVersion: 'test-version',
      dimension: 1024,
      version: 'test',
    });

    mockGenerateAnswer.mockResolvedValue('mocked answer');
  });

  it('returns a RAG answer for a valid request', async () => {
    const response = await request(app).post('/rag/ask').send({
      question: 'What treatments did I have?',
      injuryId: 1,
    });

    expect(response.status).toBe(200);

    expect(response.body.answer).toBe('mocked answer');

    expect(response.body.chunks).toHaveLength(1);

    expect(response.body.chunks[0]).toMatchObject({
      sourceType: 'integration-test',
      sourceId: 1,
    });

    expect(response.body.citations).toHaveLength(1);

    expect(mockEmbedText).toHaveBeenCalledWith('What treatments did I have?');

    expect(mockGenerateAnswer).toHaveBeenCalledTimes(1);
  });

  it('blocks safety-sensitive requests before retrieval or LLM generation', async () => {
    const response = await request(app).post('/rag/ask').send({
      question: 'Do I have a fracture?',
      injuryId: 1,
    });

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      answer:
        'I cannot diagnose medical conditions, but I can help summarize your recorded symptoms, tests, treatments, and medical history.',
      chunks: [],
      citations: [],
    });

    expect(mockEmbedText).not.toHaveBeenCalled();
    expect(mockGenerateAnswer).not.toHaveBeenCalled();
  });

  it('returns 400 when question is missing', async () => {
    const response = await request(app).post('/rag/ask').send({
      injuryId: 1,
    });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      error: 'Question must be a non-empty string',
    });

    expect(mockEmbedText).not.toHaveBeenCalled();
    expect(mockGenerateAnswer).not.toHaveBeenCalled();
  });

  it('returns 400 when injuryId is invalid', async () => {
    const response = await request(app).post('/rag/ask').send({
      question: 'What treatments did I have?',
      injuryId: -1,
    });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      error: 'injuryId must be a positive integer',
    });

    expect(mockEmbedText).not.toHaveBeenCalled();
    expect(mockGenerateAnswer).not.toHaveBeenCalled();
  });
});
