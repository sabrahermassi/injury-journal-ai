// These tests document the *current* absence of user-level data isolation (issue #91).
// Requests are now authenticated (#94), but there is still no per-tool/retrieval authorization
// (#95), so several assertions here lock in leaky-by-design behavior rather than correct
// behavior: an authenticated caller can still read another user's data. Once #95 lands, the
// tests that currently assert a leak should be rewritten to assert isolation instead.

import { jest } from '@jest/globals';
import request from 'supertest';
import { storeDocumentChunk } from '../../src/embeddings/vector-storage.js';
import { prisma } from '../../src/lib/prisma.js';
import { createTestInjury, deleteTestInjury } from './test-injury-fixuture.js';
import { signTestToken } from '../helpers/auth.js';

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

describe('data isolation regression tests', () => {
  let injuryAId: number;
  let userAId: number;
  let injuryBId: number;
  let userBId: number;
  let authHeader: string;

  beforeAll(async () => {
    const a = await createTestInjury('Data Isolation Test A');
    const b = await createTestInjury('Data Isolation Test B');

    injuryAId = a.injuryId;
    userAId = a.userId;
    injuryBId = b.injuryId;
    userBId = b.userId;
    authHeader = `Bearer ${signTestToken(userAId)}`;

    await storeDocumentChunk(
      injuryAId,
      userAId,
      'data-isolation-integration-test',
      1,
      0,
      'Chunk belonging to injury A',
      vectorWith(1, 0, 0),
    );

    await storeDocumentChunk(
      injuryBId,
      userBId,
      'data-isolation-integration-test',
      2,
      0,
      'Chunk belonging to injury B',
      vectorWith(1, 0, 0),
    );
  });

  afterAll(async () => {
    await deleteTestInjury(injuryAId, userAId);
    await deleteTestInjury(injuryBId, userBId);
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

  it('scopes RAG retrieval to the requested injuryId and excludes another injury/user', async () => {
    const response = await request(app)
      .post('/ai-agent')
      .set('Authorization', authHeader)
      .send({
        question: 'What treatments did I have?',
        injuryId: injuryAId,
      });

    expect(response.status).toBe(200);

    expect(response.body.metadata.retrievedChunks).toEqual([
      {
        sourceType: 'data-isolation-integration-test',
        sourceId: 1,
      },
    ]);
  });

  it('leaks chunks across injuries/users when injuryId is omitted', async () => {
    const response = await request(app)
      .post('/ai-agent')
      .set('Authorization', authHeader)
      .send({
        question: 'What treatments did I have?',
      });

    expect(response.status).toBe(200);

    const sourceIds = (
      response.body.metadata.retrievedChunks as {
        sourceType: string;
        sourceId: number;
      }[]
    )
      .filter((chunk) => chunk.sourceType === 'data-isolation-integration-test')
      .map((chunk) => chunk.sourceId)
      .sort();

    expect(sourceIds).toEqual([1, 2]);
  });

  it('returns any injury record to any caller with no ownership check', async () => {
    const response = await request(app)
      .post('/ai-agent')
      .set('Authorization', authHeader)
      .send({
        question: 'Show me my injury timeline',
        injuryId: injuryBId,
      });

    expect(response.status).toBe(200);
    expect(response.body.intent).toBe('journal');
    expect(response.body.answer).toBe('mocked agent answer');

    expect(mockGenerateAnswer.mock.calls[0][0]).toContain(
      'Data Isolation Test B',
    );
  });
});
