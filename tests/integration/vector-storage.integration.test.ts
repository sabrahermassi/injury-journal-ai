import { PrismaClient } from '@prisma/client';
import {
  searchSimilarChunks,
  storeDocumentChunk,
  disconnectVectorStorage,
  MAX_COSINE_DISTANCE,
} from '../../src/embeddings/vector-storage.js';
import {
  createTestInjury,
  deleteTestInjury,
} from './test-injury-fixuture.js';

const prisma = new PrismaClient();

function vectorWith(first: number, second = 0, third = 0): number[] {
  const vector = new Array<number>(1024).fill(0);

  vector[0] = first;
  vector[1] = second;
  vector[2] = third;

  return vector;
}

describe('vector storage integration', () => {
  let injuryA: { userId: number; injuryId: number };
  let injuryB: { userId: number; injuryId: number };

  beforeAll(async () => {
    injuryA = await createTestInjury('Vector Storage Test 1');
    injuryB = await createTestInjury('Vector Storage Test 2');
  });

  beforeEach(async () => {
    await prisma.$executeRaw`
      DELETE FROM "DocumentChunk"
      WHERE "sourceType" = 'vector-storage-integration-test'
    `;
  });

  afterAll(async () => {
    await prisma.$executeRaw`
      DELETE FROM "DocumentChunk"
      WHERE "sourceType" = 'vector-storage-integration-test'
    `;

    await deleteTestInjury(injuryA.injuryId, injuryA.userId);
    await deleteTestInjury(injuryB.injuryId, injuryB.userId);

    await disconnectVectorStorage();

    await prisma.$disconnect();
  });

  it('retrieves chunks ordered by cosine similarity', async () => {
    await storeDocumentChunk(
      injuryA.injuryId,
      injuryA.userId,
      'vector-storage-integration-test',
      1,
      0,
      'Very similar chunk',
      vectorWith(1, 0, 0),
      'test-model',
      'v1',
    );

    await storeDocumentChunk(
      injuryA.injuryId,
      injuryA.userId,
      'vector-storage-integration-test',
      1,
      1,
      'Somewhat similar chunk',
      vectorWith(0.7, 0.7, 0),
      'test-model',
      'v1',
    );

    await storeDocumentChunk(
      injuryA.injuryId,
      injuryA.userId,
      'vector-storage-integration-test',
      1,
      2,
      'Unrelated chunk',
      vectorWith(0, 0, 1),
      'test-model',
      'v1',
    );

    const results = await searchSimilarChunks(
      vectorWith(1, 0, 0),
      'test-model',
      'v1',
      undefined,
      3,
      'vector-storage-integration-test',
      undefined,
      undefined,
      MAX_COSINE_DISTANCE,
    );

    expect(results).toHaveLength(3);

    expect(results[0].content).toBe('Very similar chunk');
    expect(results[1].content).toBe('Somewhat similar chunk');
    expect(results[2].content).toBe('Unrelated chunk');

    expect(results[0].distance).toBeLessThan(results[1].distance);
    expect(results[1].distance).toBeLessThan(results[2].distance);
  });

  it('respects the result limit', async () => {
    await storeDocumentChunk(
      injuryA.injuryId,
      injuryA.userId,
      'vector-storage-integration-test',
      2,
      0,
      'chunk 1',
      vectorWith(1, 0, 0),
      'test-model',
      'v1',
    );

    await storeDocumentChunk(
      injuryA.injuryId,
      injuryA.userId,
      'vector-storage-integration-test',
      2,
      1,
      'chunk 2',
      vectorWith(0.9, 0.1, 0),
      'test-model',
      'v1',
    );

    await storeDocumentChunk(
      injuryA.injuryId,
      injuryA.userId,
      'vector-storage-integration-test',
      2,
      2,
      'chunk 3',
      vectorWith(0, 1, 0),
      'test-model',
      'v1',
    );

    const results = await searchSimilarChunks(
      vectorWith(1, 0, 0),
      'test-model',
      'v1',
      undefined,
      2,
      'vector-storage-integration-test',
    );

    expect(results).toHaveLength(2);
  });

  it('filters results by injuryId when provided', async () => {
    await storeDocumentChunk(
      injuryA.injuryId,
      injuryA.userId,
      'vector-storage-integration-test',
      3,
      0,
      'Injury 1 relevant chunk',
      vectorWith(1, 0, 0),
      'test-model',
      'v1',
    );

    await storeDocumentChunk(
      injuryB.injuryId,
      injuryB.userId,
      'vector-storage-integration-test',
      4,
      0,
      'Injury 2 relevant chunk',
      vectorWith(1, 0, 0),
      'test-model',
      'v1',
    );

    const results = await searchSimilarChunks(
      vectorWith(1, 0, 0),
      'test-model',
      'v1',
      injuryA.injuryId,
      5,
      'vector-storage-integration-test',
    );

    expect(results).toHaveLength(1);
    expect(results[0].content).toBe('Injury 1 relevant chunk');
    expect(results[0].injuryId).toBe(injuryA.injuryId);
  });

  it('filters results by userId when provided', async () => {
    await storeDocumentChunk(
      injuryA.injuryId,
      injuryA.userId,
      'vector-storage-integration-test',
      6,
      0,
      'User 1 relevant chunk',
      vectorWith(1, 0, 0),
      'test-model',
      'v1',
    );

    await storeDocumentChunk(
      injuryB.injuryId,
      injuryB.userId,
      'vector-storage-integration-test',
      7,
      0,
      'User 2 relevant chunk',
      vectorWith(1, 0, 0),
      'test-model',
      'v1',
    );

    const results = await searchSimilarChunks(
      vectorWith(1, 0, 0),
      'test-model',
      'v1',
      undefined,
      5,
      'vector-storage-integration-test',
      injuryA.userId,
    );

    expect(results).toHaveLength(1);
    expect(results[0].content).toBe('User 1 relevant chunk');
    expect(results[0].userId).toBe(injuryA.userId);
  });

  it('excludes rows from a different sourceType even when their vector is closer', async () => {
    await storeDocumentChunk(
      injuryA.injuryId,
      injuryA.userId,
      'vector-storage-integration-test',
      5,
      0,
      'Own sourceType chunk',
      vectorWith(0, 1, 0),
      'test-model',
      'v1',
    );

    await storeDocumentChunk(
      injuryA.injuryId,
      injuryA.userId,
      'some-other-source-type',
      5,
      0,
      'Foreign sourceType chunk, closer vector',
      vectorWith(1, 0, 0),
      'test-model',
      'v1',
    );

    const results = await searchSimilarChunks(
      vectorWith(1, 0, 0),
      'test-model',
      'v1',
      undefined,
      5,
      'vector-storage-integration-test',
      undefined,
      undefined,
      MAX_COSINE_DISTANCE,
    );

    expect(results).toHaveLength(1);
    expect(results[0].content).toBe('Own sourceType chunk');

    await prisma.$executeRaw`
      DELETE FROM "DocumentChunk"
      WHERE "sourceType" = 'some-other-source-type'
    `;
  });

  it('drops chunks beyond maxDistance and keeps ones within it (#122)', async () => {
    await storeDocumentChunk(
      injuryA.injuryId,
      injuryA.userId,
      'vector-storage-integration-test',
      8,
      0,
      'Close chunk',
      vectorWith(1, 0, 0),
      'test-model',
      'v1',
    );

    await storeDocumentChunk(
      injuryA.injuryId,
      injuryA.userId,
      'vector-storage-integration-test',
      8,
      1,
      'Orthogonal chunk',
      vectorWith(0, 1, 0),
      'test-model',
      'v1',
    );

    const results = await searchSimilarChunks(
      vectorWith(1, 0, 0),
      'test-model',
      'v1',
      undefined,
      5,
      'vector-storage-integration-test',
      undefined,
      undefined,
      0.5,
    );

    expect(results).toHaveLength(1);
    expect(results[0].content).toBe('Close chunk');
  });

  it('excludes chunks embedded by a different model/version even when their vector is closest (#133)', async () => {
    await storeDocumentChunk(
      injuryA.injuryId,
      injuryA.userId,
      'vector-storage-integration-test',
      9,
      0,
      'Current-model chunk, farther vector',
      vectorWith(0.7, 0.7, 0),
      'test-model',
      'v1',
    );

    await storeDocumentChunk(
      injuryA.injuryId,
      injuryA.userId,
      'vector-storage-integration-test',
      9,
      1,
      'Old-model chunk, closest vector',
      vectorWith(1, 0, 0),
      'old-model',
      'v0',
    );

    const results = await searchSimilarChunks(
      vectorWith(1, 0, 0),
      'test-model',
      'v1',
      undefined,
      5,
      'vector-storage-integration-test',
      undefined,
      undefined,
      MAX_COSINE_DISTANCE,
    );

    expect(results).toHaveLength(1);
    expect(results[0].content).toBe('Current-model chunk, farther vector');
  });
});
