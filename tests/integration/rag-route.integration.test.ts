import { jest } from '@jest/globals';
import request from 'supertest';
import { storeDocumentChunk } from '../../src/embeddings/vector-storage.js';
import { prisma } from '../../src/lib/prisma.js';
import { createTestInjury, deleteTestInjury } from './test-injury-fixuture.js';

jest.unstable_mockModule('../../src/embeddings/embedding-client.js', () => ({
  embedQuery: jest.fn(),
}));

jest.unstable_mockModule('../../src/llm/llm-client.js', () => ({
  generateAnswer: jest.fn(),
}));

const { embedQuery } = await import('../../src/embeddings/embedding-client.js');
const { generateAnswer } = await import('../../src/llm/llm-client.js');
const { default: app } = await import('../../src/app.js');

const mockEmbedQuery = jest.mocked(embedQuery);
const mockGenerateAnswer = jest.mocked(generateAnswer);

function vectorWith(first: number, second = 0, third = 0): number[] {
  const vector = new Array<number>(1024).fill(0);

  vector[0] = first;
  vector[1] = second;
  vector[2] = third;

  return vector;
}

describe('RAG route integration', () => {
  let injuryId: number;
  let userId: number;

  let otherInjuryId: number;
  let otherUserId: number;

  beforeAll(async () => {
    const testInjury = await createTestInjury('RAG Route Test');

    injuryId = testInjury.injuryId;
    userId = testInjury.userId;

    const otherInjury = await createTestInjury('Other Injury');

    otherInjuryId = otherInjury.injuryId;
    otherUserId = otherInjury.userId;

    await storeDocumentChunk(
      injuryId,
      'rag-route-integration-test',
      1,
      0,
      'Physiotherapy helped improve my hip pain.',
      vectorWith(1, 0, 0),
    );

    await storeDocumentChunk(
      injuryId,
      'rag-route-integration-test',
      1,
      1,
      'I also received physiotherapy exercises.',
      vectorWith(0.9, 0.1, 0),
    );

    await storeDocumentChunk(
      otherInjuryId,
      'rag-route-integration-test',
      2,
      0,
      'Physiotherapy helped improve my knee pain.',
      vectorWith(1, 0, 0),
    );
  });

  afterAll(async () => {
    await deleteTestInjury(injuryId, userId);
    await deleteTestInjury(otherInjuryId, otherUserId);

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

  it('returns a RAG answer for a valid request', async () => {
    const response = await request(app).post('/rag/ask').send({
      question: 'What treatments did I have?',
      injuryId,
    });

    expect(response.status).toBe(200);

    expect(response.body.answer).toBe('mocked answer');

    expect(response.body.chunks).toHaveLength(2);

    expect(response.body.chunks[0]).toMatchObject({
      sourceType: 'rag-route-integration-test',
      sourceId: 1,
    });

    expect(response.body.chunks[1]).toMatchObject({
      sourceType: 'rag-route-integration-test',
      sourceId: 1,
    });

    expect(response.body.citations).toHaveLength(1);

    expect(mockEmbedQuery).toHaveBeenCalledWith('What treatments did I have?');

    expect(mockGenerateAnswer).toHaveBeenCalledTimes(1);
  });

  it('returns relevant RAG chunks only for the requested injury', async () => {
    const response = await request(app).post('/rag/ask').send({
      question: 'What treatments did I have?',
      injuryId,
    });

    expect(response.status).toBe(200);
    expect(response.body.answer).toBe('mocked answer');

    expect(response.body.chunks).toHaveLength(2);

    expect(
      response.body.chunks.every(
        (chunk: { injuryId: number }) => chunk.injuryId === injuryId,
      ),
    ).toBe(true);

    expect(
      response.body.chunks.some(
        (chunk: { injuryId: number }) => chunk.injuryId === otherInjuryId,
      ),
    ).toBe(false);

    expect(response.body.citations).toHaveLength(1);
  });

  it('blocks safety-sensitive requests before retrieval or LLM generation', async () => {
    const response = await request(app).post('/rag/ask').send({
      question: 'Do I have a fracture?',
      injuryId,
    });

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      answer:
        'I cannot diagnose medical conditions, but I can help summarize your recorded symptoms, tests, treatments, and medical history.',
      chunks: [],
      citations: [],
    });

    expect(mockEmbedQuery).not.toHaveBeenCalled();
    expect(mockGenerateAnswer).not.toHaveBeenCalled();
  });

  it('returns 400 when question is missing', async () => {
    const response = await request(app).post('/rag/ask').send({
      injuryId,
    });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      error: 'Question must be a non-empty string',
    });

    expect(mockEmbedQuery).not.toHaveBeenCalled();
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

    expect(mockEmbedQuery).not.toHaveBeenCalled();
    expect(mockGenerateAnswer).not.toHaveBeenCalled();
  });
});
