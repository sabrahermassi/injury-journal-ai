import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import aiAgentRouter from './routes/ai-agent-router.js';
import { authenticate } from './auth/authenticate.js';

const app = express();

app.set('trust proxy', 1);

app.use(helmet());

// No real deployed frontend origin exists yet (see #97), so unset
// ALLOWED_ORIGIN reflects the request's own origin -- identical to today's
// behavior. Setting it restricts CORS to the given comma-separated origins.
const allowedOrigins = process.env.ALLOWED_ORIGIN?.split(',').map((origin) =>
  origin.trim(),
);

app.use(cors({ origin: allowedOrigins ?? true }));

app.use(express.json());

const aiAgentLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

app.use('/ai-agent', aiAgentLimiter, authenticate, aiAgentRouter);

export default app;
