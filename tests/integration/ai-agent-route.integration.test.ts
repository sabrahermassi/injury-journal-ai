import { jest } from '@jest/globals';
import request from 'supertest';
import { storeDocumentChunk } from '../../src/embeddings/vector-storage.js';
import { prisma } from '../../src/lib/prisma.js';
import { createTestInjury, deleteTestInjury } from './test-injury-fixuture.js';
import { signTestToken } from '../helpers/auth.js';

jest.unstable_mockModule('../../src/embeddings/embedding-client.js', () => ({
  embedQuery: jest.fn(),
  EmbeddingServiceError: class EmbeddingServiceError extends Error {},
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

describe('AI agent route integration', () => {
  let injuryId: number;
  let userId: number;
  let authHeader: string;
  let treatmentId: number;

  beforeAll(async () => {
    const testInjury = await createTestInjury('AI Agent Route Test');

    injuryId = testInjury.injuryId;
    userId = testInjury.userId;
    authHeader = `Bearer ${signTestToken(userId)}`;

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

    mockGenerateAnswer.mockResolvedValue('mocked agent answer');
  });

  it('routes a RAG question through the RAG tool', async () => {
    const response = await request(app)
      .post('/ai-agent')
      .set('Authorization', authHeader)
      .send({
        question: 'What treatments did I have?',
        injuryId,
      });

    expect(response.status).toBe(200);

    expect(response.body.answer).toBe('mocked agent answer');

    expect(response.body.citations).toHaveLength(1);

    expect(response.body.metadata.retrievedChunks).toEqual([
      {
        sourceType: 'treatment',
        sourceId: treatmentId,
        injuryId,
      },
    ]);

    expect(mockEmbedQuery).toHaveBeenCalledWith(
      'What treatments did I have?',
      expect.any(String),
    );

    expect(mockGenerateAnswer).toHaveBeenCalledTimes(1);
  });

  it('blocks safety-sensitive questions before retrieval or LLM generation', async () => {
    const response = await request(app)
      .post('/ai-agent')
      .set('Authorization', authHeader)
      .send({
        question: 'Do I have a fracture?',
        injuryId,
      });

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      answer:
        'I cannot diagnose medical conditions or identify what condition you may have, but I can help summarize your recorded symptoms, tests, treatments, and medical history.',
      citations: [],
      intent: 'safety',
      metadata: {
        retrievedChunks: [],
      },
    });

    expect(mockEmbedQuery).not.toHaveBeenCalled();
    expect(mockGenerateAnswer).not.toHaveBeenCalled();
  });

  it('routes a journal question to the journal tool when injuryId is provided', async () => {
    const response = await request(app)
      .post('/ai-agent')
      .set('Authorization', authHeader)
      .send({
        question: 'Show me my injury timeline',
        injuryId,
      });

    expect(response.status).toBe(200);

    expect(response.body.answer).toBe('mocked agent answer');

    expect(response.body.citations).toEqual([]);

    expect(mockEmbedQuery).not.toHaveBeenCalled();

    expect(mockGenerateAnswer).toHaveBeenCalledTimes(1);

    expect(mockGenerateAnswer.mock.calls[0][1]).toContain(
      'AI Agent Route Test',
    );
  });

  it('returns a fallback message when journal answer generation is empty', async () => {
    mockGenerateAnswer.mockResolvedValue('');

    const response = await request(app)
      .post('/ai-agent')
      .set('Authorization', authHeader)
      .send({
        question: 'Show me my injury timeline',
        injuryId,
      });

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      answer: 'Unable to generate a summary from your injury record right now.',
      citations: [],
      intent: 'journal',
    });

    expect(mockGenerateAnswer).toHaveBeenCalledTimes(1);
  });

  it('requires an injuryId for journal questions', async () => {
    const response = await request(app)
      .post('/ai-agent')
      .set('Authorization', authHeader)
      .send({
        question: 'Show me my injury timeline',
      });

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      answer: 'An injury must be selected for journal questions.',
      citations: [],
      intent: 'journal',
    });

    expect(mockEmbedQuery).not.toHaveBeenCalled();
    expect(mockGenerateAnswer).not.toHaveBeenCalled();
  });

  it('returns 400 when question is empty', async () => {
    const response = await request(app)
      .post('/ai-agent')
      .set('Authorization', authHeader)
      .send({
        question: '',
        injuryId,
      });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      error: 'Question is required',
      code: 'question_required',
    });

    expect(mockEmbedQuery).not.toHaveBeenCalled();
    expect(mockGenerateAnswer).not.toHaveBeenCalled();
  });

  it('returns 401 when no Authorization header is provided', async () => {
    const response = await request(app).post('/ai-agent').send({
      question: 'What treatments did I have?',
      injuryId,
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: 'Authentication required',
      code: 'authentication_required',
    });
    expect(mockEmbedQuery).not.toHaveBeenCalled();
  });

  it('returns 401 for an invalid token', async () => {
    const response = await request(app)
      .post('/ai-agent')
      .set('Authorization', 'Bearer not-a-real-token')
      .send({
        question: 'What treatments did I have?',
        injuryId,
      });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: 'Invalid or expired token',
      code: 'invalid_token',
    });
    expect(mockEmbedQuery).not.toHaveBeenCalled();
  });
});
