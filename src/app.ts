import express from 'express';
import rateLimit from 'express-rate-limit';
import aiAgentRouter from './routes/ai-agent-router.js';

const app = express();

app.set('trust proxy', 1);

app.use(express.json());

const aiAgentLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

app.use('/ai-agent', aiAgentLimiter, aiAgentRouter);

export default app;
