import express from 'express';
import ragRouter from './routes/rag-router.js';
import aiAgentRouter from './routes/ai-agent-router.js';

const app = express();

app.use(express.json());

app.use('/rag', ragRouter);
app.use('/ai-agent', aiAgentRouter);

export default app;
