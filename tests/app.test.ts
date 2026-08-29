import { jest } from '@jest/globals';
import request from 'supertest';
import { signTestToken } from './helpers/auth.js';

const authHeader = `Bearer ${signTestToken(1)}`;

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

describe('GET / static frontend', () => {
  it('serves the static index page', async () => {
    const { app, prisma } = await loadApp();

    try {
      const response = await request(app).get('/');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/text\/html/);
      expect(response.text).toContain('Injury Journal AI');
    } finally {
      await prisma.$disconnect();
    }
  });

  it('serves the static app.js bundle', async () => {
    const { app, prisma } = await loadApp();

    try {
      const response = await request(app).get('/app.js');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/javascript/);
      expect(response.text).toContain('submitQuestion');
    } finally {
      await prisma.$disconnect();
    }
  });
});

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
        .set('Authorization', authHeader)
        .send({ question: SAFETY_BLOCKED_QUESTION });

      expect(response.status).toBe(200);
    } finally {
      await prisma.$disconnect();
    }
  });

  it('allows a user up to their configured limit, then returns 429 with a JSON error body', async () => {
    const { app, prisma } = await loadApp();

    try {
      for (let i = 0; i < 20; i++) {
        const response = await request(app)
          .post('/ai-agent')
          .set('Authorization', authHeader)
          .send({ question: SAFETY_BLOCKED_QUESTION });

        expect(response.status).toBe(200);
      }

      const limitedResponse = await request(app)
        .post('/ai-agent')
        .set('Authorization', authHeader)
        .send({ question: SAFETY_BLOCKED_QUESTION });

      expect(limitedResponse.status).toBe(429);
      expect(limitedResponse.headers['content-type']).toMatch(
        /application\/json/,
      );
      expect(limitedResponse.body).toEqual({
        error: 'Too many requests, please try again later.',
        code: 'rate_limited',
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('does not let one user exhausting their budget rate-limit a different user on the same IP (#145)', async () => {
    const { app, prisma } = await loadApp();
    const otherUserAuthHeader = `Bearer ${signTestToken(2)}`;

    try {
      for (let i = 0; i < 20; i++) {
        const response = await request(app)
          .post('/ai-agent')
          .set('Authorization', authHeader)
          .send({ question: SAFETY_BLOCKED_QUESTION });

        expect(response.status).toBe(200);
      }

      const otherUserResponse = await request(app)
        .post('/ai-agent')
        .set('Authorization', otherUserAuthHeader)
        .send({ question: SAFETY_BLOCKED_QUESTION });

      expect(otherUserResponse.status).toBe(200);
    } finally {
      await prisma.$disconnect();
    }
  });

  it('does not rate-limit unauthenticated requests against the per-user budget (#145)', async () => {
    const { app, prisma } = await loadApp();

    try {
      for (let i = 0; i < 21; i++) {
        const response = await request(app)
          .post('/ai-agent')
          .send({ question: SAFETY_BLOCKED_QUESTION });

        expect(response.status).toBe(401);
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  it('reports both the ip and user rate-limit policies in the RateLimit headers', async () => {
    const { app, prisma } = await loadApp();

    try {
      const response = await request(app)
        .post('/ai-agent')
        .set('Authorization', authHeader)
        .send({ question: SAFETY_BLOCKED_QUESTION });

      expect(response.status).toBe(200);
      expect(response.headers.ratelimit).toContain('"ip"');
      expect(response.headers.ratelimit).toContain('"user"');
      expect(response.headers['ratelimit-policy']).toContain('"ip"');
      expect(response.headers['ratelimit-policy']).toContain('"user"');
    } finally {
      await prisma.$disconnect();
    }
  });

  it('still bounds anonymous request volume via the per-IP limiter (#145)', async () => {
    const { app, prisma } = await loadApp();

    try {
      for (let i = 0; i < 40; i++) {
        const response = await request(app)
          .post('/ai-agent')
          .send({ question: SAFETY_BLOCKED_QUESTION });

        expect(response.status).toBe(401);
      }

      const limitedResponse = await request(app)
        .post('/ai-agent')
        .send({ question: SAFETY_BLOCKED_QUESTION });

      expect(limitedResponse.status).toBe(429);
      expect(limitedResponse.body).toEqual({
        error: 'Too many requests, please try again later.',
        code: 'rate_limited',
      });
    } finally {
      await prisma.$disconnect();
    }
  });
});

describe('security headers and CORS', () => {
  const originalAllowedOrigin = process.env.ALLOWED_ORIGIN;

  afterEach(() => {
    if (originalAllowedOrigin === undefined) {
      delete process.env.ALLOWED_ORIGIN;
    } else {
      process.env.ALLOWED_ORIGIN = originalAllowedOrigin;
    }
  });

  it('sets helmet security headers and removes X-Powered-By', async () => {
    const { app, prisma } = await loadApp();

    try {
      const response = await request(app)
        .post('/ai-agent')
        .send({ question: SAFETY_BLOCKED_QUESTION });

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-powered-by']).toBeUndefined();
    } finally {
      await prisma.$disconnect();
    }
  });

  it('reflects the request origin when ALLOWED_ORIGIN is unset', async () => {
    delete process.env.ALLOWED_ORIGIN;

    const { app, prisma } = await loadApp();

    try {
      const response = await request(app)
        .post('/ai-agent')
        .set('Origin', 'https://example.com')
        .send({ question: SAFETY_BLOCKED_QUESTION });

      expect(response.headers['access-control-allow-origin']).toBe(
        'https://example.com',
      );
    } finally {
      await prisma.$disconnect();
    }
  });

  it('reflects the request origin when ALLOWED_ORIGIN is present but blank', async () => {
    // Regression test: an unfilled `ALLOWED_ORIGIN=` copied verbatim from
    // .env.example sets the env var to an empty string, not undefined --
    // this must behave the same as fully unset, not silently block every
    // cross-origin request.
    process.env.ALLOWED_ORIGIN = '';

    const { app, prisma } = await loadApp();

    try {
      const response = await request(app)
        .post('/ai-agent')
        .set('Origin', 'https://example.com')
        .send({ question: SAFETY_BLOCKED_QUESTION });

      expect(response.headers['access-control-allow-origin']).toBe(
        'https://example.com',
      );
    } finally {
      await prisma.$disconnect();
    }
  });

  it('restricts CORS to the configured origins when ALLOWED_ORIGIN is set', async () => {
    process.env.ALLOWED_ORIGIN = 'https://allowed.example.com';

    const { app, prisma } = await loadApp();

    try {
      const allowed = await request(app)
        .post('/ai-agent')
        .set('Origin', 'https://allowed.example.com')
        .send({ question: SAFETY_BLOCKED_QUESTION });

      expect(allowed.headers['access-control-allow-origin']).toBe(
        'https://allowed.example.com',
      );

      const disallowed = await request(app)
        .post('/ai-agent')
        .set('Origin', 'https://not-allowed.example.com')
        .send({ question: SAFETY_BLOCKED_QUESTION });

      expect(
        disallowed.headers['access-control-allow-origin'],
      ).toBeUndefined();
    } finally {
      await prisma.$disconnect();
    }
  });
});
