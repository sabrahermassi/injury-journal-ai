import { PrismaClient } from '@prisma/client';
import {
  searchSimilarChunks,
  storeDocumentChunk,
  disconnectVectorStorage,
} from '../../src/embeddings/vector-storage.js';

const prisma = new PrismaClient();

function vectorWith(first: number, second = 0, third = 0): number[] {
  const vector = new Array<number>(1024).fill(0);

  vector[0] = first;
  vector[1] = second;
  vector[2] = third;

  return vector;
}

describe('vector storage integration', () => {
  beforeEach(async () => {
    await prisma.$executeRaw`
      DELETE FROM "DocumentChunk"
      WHERE "sourceType" = 'integration-test'
    `;
  });

  afterAll(async () => {
    await prisma.$executeRaw`
      DELETE FROM "DocumentChunk"
      WHERE "sourceType" = 'integration-test'
    `;

    await disconnectVectorStorage();

    await prisma.$disconnect();
  });

  it('retrieves chunks ordered by cosine similarity', async () => {
    await storeDocumentChunk(
      1,
      'integration-test',
      1,
      0,
      'Very similar chunk',
      vectorWith(1, 0, 0),
    );

    await storeDocumentChunk(
      1,
      'integration-test',
      1,
      1,
      'Somewhat similar chunk',
      vectorWith(0.7, 0.7, 0),
    );

    await storeDocumentChunk(
      1,
      'integration-test',
      1,
      2,
      'Unrelated chunk',
      vectorWith(0, 0, 1),
    );

    const results = await searchSimilarChunks(vectorWith(1, 0, 0), 3);

    expect(results).toHaveLength(3);

    expect(results[0].content).toBe('Very similar chunk');
    expect(results[1].content).toBe('Somewhat similar chunk');
    expect(results[2].content).toBe('Unrelated chunk');

    expect(results[0].distance).toBeLessThan(results[1].distance);
    expect(results[1].distance).toBeLessThan(results[2].distance);
  });

  it('respects the result limit', async () => {
    await storeDocumentChunk(
      1,
      'integration-test',
      2,
      0,
      'chunk 1',
      vectorWith(1, 0, 0),
    );

    await storeDocumentChunk(
      1,
      'integration-test',
      2,
      1,
      'chunk 2',
      vectorWith(0.9, 0.1, 0),
    );

    await storeDocumentChunk(
      1,
      'integration-test',
      2,
      2,
      'chunk 3',
      vectorWith(0, 1, 0),
    );

    const results = await searchSimilarChunks(vectorWith(1, 0, 0), 2);

    expect(results).toHaveLength(2);
  });

  it('filters results by injuryId when provided', async () => {
    await storeDocumentChunk(
      1,
      'integration-test',
      3,
      0,
      'Injury 1 relevant chunk',
      vectorWith(1, 0, 0),
    );

    await storeDocumentChunk(
      2,
      'integration-test',
      4,
      0,
      'Injury 2 relevant chunk',
      vectorWith(1, 0, 0),
    );

    const results = await searchSimilarChunks(vectorWith(1, 0, 0), 5, 1);

    expect(results).toHaveLength(1);
    expect(results[0].content).toBe('Injury 1 relevant chunk');
    expect(results[0].injuryId).toBe(1);
  });
});
