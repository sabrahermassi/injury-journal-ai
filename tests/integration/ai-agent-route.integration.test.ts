import { jest } from '@jest/globals';
import request from 'supertest';
import { storeDocumentChunk } from '../../src/embeddings/vector-storage.js';
import { prisma } from '../../src/lib/prisma.js';
import { createTestInjury, deleteTestInjury } from './test-injury-fixuture.js';

jest.unstable_mockModule('../../src/embeddings/embedding-client.js', () => ({
  embedText: jest.fn(),
}));

jest.unstable_mockModule('../../src/llm/llm-client.js', () => ({
  generateAnswer: jest.fn(),
}));

const { default: app } = await import('../../src/app.js');
const { embedText } = await import('../../src/embeddings/embedding-client.js');
const { generateAnswer } = await import('../../src/llm/llm-client.js');

const mockEmbedText = jest.mocked(embedText);
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

  beforeAll(async () => {
    const testInjury = await createTestInjury('AI Agent Route Test');

    injuryId = testInjury.injuryId;
    userId = testInjury.userId;

    await storeDocumentChunk(
      injuryId,
      'ai-agent-integration-test',
      1,
      0,
      'Physiotherapy helped improve my hip pain.',
      vectorWith(1, 0, 0),
    );
  });

  afterAll(async () => {
    await deleteTestInjury(injuryId, userId);
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

    mockGenerateAnswer.mockResolvedValue('mocked agent answer');
  });

  it('routes a RAG question through the RAG tool', async () => {
    const response = await request(app).post('/ai-agent').send({
      question: 'What treatments did I have?',
      injuryId,
    });

    expect(response.status).toBe(200);

    expect(response.body.answer).toBe('mocked agent answer');

    expect(response.body.citations).toHaveLength(1);

    expect(response.body.metadata.retrievedChunks).toEqual([
      {
        sourceType: 'ai-agent-integration-test',
        sourceId: 1,
      },
    ]);

    expect(mockEmbedText).toHaveBeenCalledWith('What treatments did I have?');

    expect(mockGenerateAnswer).toHaveBeenCalledTimes(1);
  });

  it('blocks safety-sensitive questions before retrieval or LLM generation', async () => {
    const response = await request(app).post('/ai-agent').send({
      question: 'Do I have a fracture?',
      injuryId,
    });

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      answer:
        'I cannot diagnose medical conditions, but I can help summarize your recorded symptoms, tests, treatments, and medical history.',
      citations: [],
      metadata: {
        retrievedChunks: [],
      },
    });

    expect(mockEmbedText).not.toHaveBeenCalled();
    expect(mockGenerateAnswer).not.toHaveBeenCalled();
  });

  it('routes a journal question to the journal tool when injuryId is provided', async () => {
    const response = await request(app).post('/ai-agent').send({
      question: 'Show me my injury timeline',
      injuryId,
    });

    expect(response.status).toBe(200);

    expect(response.body.answer).toBe('mocked agent answer');

    expect(response.body.citations).toEqual([]);

    expect(mockEmbedText).not.toHaveBeenCalled();

    expect(mockGenerateAnswer).toHaveBeenCalledTimes(1);

    expect(mockGenerateAnswer.mock.calls[0][0]).toContain('AI Agent Route Test');
  });

  it('requires an injuryId for journal questions', async () => {
    const response = await request(app).post('/ai-agent').send({
      question: 'Show me my injury timeline',
    });

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      answer: 'An injury must be selected for journal questions.',
      citations: [],
    });

    expect(mockEmbedText).not.toHaveBeenCalled();
    expect(mockGenerateAnswer).not.toHaveBeenCalled();
  });

  it('returns 400 when question is empty', async () => {
    const response = await request(app).post('/ai-agent').send({
      question: '',
      injuryId,
    });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      error: 'Question is required',
    });

    expect(mockEmbedText).not.toHaveBeenCalled();
    expect(mockGenerateAnswer).not.toHaveBeenCalled();
  });
});
