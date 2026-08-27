import express from 'express';
import rateLimit from 'express-rate-limit';
import aiAgentRouter from './routes/ai-agent-router.js';

const app = express();

app.use(express.json());

const aiAgentLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/ai-agent', aiAgentLimiter, aiAgentRouter);

export default app;
