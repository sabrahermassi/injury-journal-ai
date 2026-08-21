import express from 'express';
import ragRouter from './routes/rag-router.js';

const app = express();

app.use(express.json());

app.use('/rag', ragRouter);

export default app;
