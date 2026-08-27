import { jest } from '@jest/globals';
import request from 'supertest';

/**
 * Uses a safety-blocked question so the request never reaches the DB,
 * embedding service, or LLM (safetyTool runs before any of that), keeping
 * this test fast and dependency-free while still exercising the real
 * rate-limit middleware mounted on `/ai-agent` in src/app.ts.
 *
 * Each test gets its own fresh app/prisma module instance (via
 * jest.resetModules()) so the in-memory rate-limit counter from one test
 * doesn't bleed into another.
 */
const SAFETY_BLOCKED_QUESTION = 'Do I have a fracture?';

describe('POST /ai-agent rate limiting', () => {
  it('does not crash when a reverse proxy sends X-Forwarded-For', async () => {
    // Regression test: express-rate-limit throws if a proxy header is
    // present but Express's 'trust proxy' setting isn't configured — this
    // would otherwise 500 every request once deployed behind a proxy/LB.
    jest.resetModules();
    const { default: app } = await import('../src/app.js');
    const { prisma } = await import('../src/lib/prisma.js');

    try {
      const response = await request(app)
        .post('/ai-agent')
        .set('X-Forwarded-For', '203.0.113.5')
        .send({ question: SAFETY_BLOCKED_QUESTION });

      expect(response.status).toBe(200);
    } finally {
      await prisma.$disconnect();
    }
  });

  it('allows up to the configured limit, then returns 429 with a JSON error body', async () => {
    jest.resetModules();
    const { default: app } = await import('../src/app.js');
    const { prisma } = await import('../src/lib/prisma.js');

    try {
      for (let i = 0; i < 20; i++) {
        const response = await request(app)
          .post('/ai-agent')
          .send({ question: SAFETY_BLOCKED_QUESTION });

        expect(response.status).toBe(200);
      }

      const limitedResponse = await request(app)
        .post('/ai-agent')
        .send({ question: SAFETY_BLOCKED_QUESTION });

      expect(limitedResponse.status).toBe(429);
      expect(limitedResponse.headers['content-type']).toMatch(
        /application\/json/,
      );
      expect(limitedResponse.body).toEqual({
        error: 'Too many requests, please try again later.',
      });
    } finally {
      await prisma.$disconnect();
    }
  });
});
