import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import aiAgentRouter from './routes/ai-agent-router.js';
import injuriesRouter from './routes/injuries-router.js';
import { authenticate } from './auth/authenticate.js';
import { ApiErrorCode } from './lib/api-error.js';

const app = express();

app.set('trust proxy', 1);

app.use(helmet());

// No real deployed frontend origin exists yet (see #97), so unset --
// including present-but-blank, e.g. an unfilled ALLOWED_ORIGIN= copied from
// .env.example -- reflects the request's own origin, identical to today's
// behavior. Setting it to a non-empty value restricts CORS to the given
// comma-separated origins.
const rawAllowedOrigin = process.env.ALLOWED_ORIGIN?.trim();
const allowedOrigins = rawAllowedOrigin
  ? rawAllowedOrigin.split(',').map((origin) => origin.trim())
  : undefined;

app.use(cors({ origin: allowedOrigins ?? true }));

app.use(express.json());

const rateLimitMessage = {
  error: 'Too many requests, please try again later.',
  code: 'rate_limited' satisfies ApiErrorCode,
};

// Lenient, keyed by IP (default). Runs before authenticate to bound the cost
// of an anonymous/invalid-token flood (JWT verification isn't free), not to
// enforce a user-facing quota — that's the per-user limiters' job (see #145).
// Kept at 2x the per-user limit rather than looser still: the original single
// limiter (#89) was sized to bound per-IP LLM/embedding cost-abuse outright,
// and this cap is what now stands between that goal and a multi-account
// attacker sharing one IP, so it deliberately isn't raised further.
//
// Deliberately a single shared instance across both routes: it bounds the cost
// of anonymous traffic from one IP, which is a property of the client rather
// than of the endpoint. The per-user quotas below are what stay independent.
const ipLimiter = rateLimit({
  windowMs: 60_000,
  limit: 40,
  standardHeaders: 'draft-8',
  identifier: 'ip',
  legacyHeaders: false,
  message: rateLimitMessage,
});

// The real per-user quota. Runs after authenticate and keys by req.userId so
// one client's failed-auth traffic can no longer exhaust another
// legitimately authenticated user's budget on a shared IP (#145).
const userLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: 'draft-8',
  identifier: 'user',
  legacyHeaders: false,
  keyGenerator: (req) => String(req.userId),
  message: rateLimitMessage,
});

// /injuries is a cheap indexed read (Injury has @@index([userId])), not an
// LLM/embedding call, so it gets a more generous per-user budget than
// /ai-agent. Its own instance keeps the two counters independent -- reloading
// the injury picker must not spend the user's question budget.
const injuriesUserLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: 'draft-8',
  identifier: 'user-injuries',
  legacyHeaders: false,
  keyGenerator: (req) => String(req.userId),
  message: rateLimitMessage,
});

app.use('/ai-agent', ipLimiter, authenticate, userLimiter, aiAgentRouter);

// Temporary -- see src/injuries/injuries-controller.ts and D10.
app.use(
  '/injuries',
  ipLimiter,
  authenticate,
  injuriesUserLimiter,
  injuriesRouter,
);

export default app;
