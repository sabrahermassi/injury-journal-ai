import { jest } from '@jest/globals';
import request from 'supertest';

/**
 * Uses a safety-blocked question so the request never reaches the DB,
 * embedding service, or LLM (safetyTool runs before any of that), keeping
 * this test fast and dependency-free while still exercising the real
 * rate-limit middleware mounted on `/ai-agent` in src/app.ts.
 *
 * llm-client.js is mocked before each import: it constructs a real Groq
 * client at module load time (requires GROQ_API_KEY), which the safety
 * path never actually needs — mocking avoids depending on that env var
 * being set at all just to import src/app.js.
 *
 * Each test gets its own fresh app/prisma module instance (via
 * jest.resetModules()) so the in-memory rate-limit counter from one test
 * doesn't bleed into another.
 */
const SAFETY_BLOCKED_QUESTION = 'Do I have a fracture?';

async function loadApp() {
  jest.resetModules();

  jest.unstable_mockModule('../src/llm/llm-client.js', () => ({
    generateAnswer: jest.fn(),
  }));

  const { default: app } = await import('../src/app.js');
  const { prisma } = await import('../src/lib/prisma.js');

  return { app, prisma };
}

describe('POST /ai-agent rate limiting', () => {
  it('does not crash when a reverse proxy sends X-Forwarded-For', async () => {
    // Regression test: express-rate-limit throws if a proxy header is
    // present but Express's 'trust proxy' setting isn't configured — this
    // would otherwise 500 every request once deployed behind a proxy/LB.
    const { app, prisma } = await loadApp();

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
    const { app, prisma } = await loadApp();

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
