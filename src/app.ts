import express from 'express';
import aiAgentRouter from './routes/ai-agent-router.js';

const app = express();

app.use(express.json());

app.use('/ai-agent', aiAgentRouter);

export default app;
