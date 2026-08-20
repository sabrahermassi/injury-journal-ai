import { Request, Response } from 'express';
import { answerQuestion } from './rag-service.js';

export async function askQuestion(req: Request, res: Response) {
  try {
    const { question, injuryId } = req.body ?? {};

    if (typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({
        error: 'Question must be a non-empty string',
      });
    }

    const answer = await answerQuestion(question, injuryId);

    return res.json({
      answer,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: 'Failed to generate answer',
    });
  }
}
