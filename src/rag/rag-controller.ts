import { randomUUID } from 'node:crypto';
import { Request, Response } from 'express';
import { answerQuestion } from './rag-service.js';

export async function askQuestion(req: Request, res: Response) {
  try {
    const requestId =
      (req.headers?.['x-request-id'] as string | undefined) ?? randomUUID();

    const { question, injuryId } = req.body ?? {};

    if (typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({
        error: 'Question must be a non-empty string',
      });
    }

    if (
      injuryId !== undefined &&
      (!Number.isInteger(injuryId) || injuryId <= 0)
    ) {
      return res.status(400).json({
        error: 'injuryId must be a positive integer',
      });
    }

    const result = await answerQuestion(question, injuryId, undefined, requestId);

    return res.json(result);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: 'Failed to generate answer',
    });
  }
}
