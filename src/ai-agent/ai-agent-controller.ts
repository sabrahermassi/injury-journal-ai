import { Request, Response } from 'express';
import { runAgent } from './ai-agent-orchestrator.js';

export async function askAgent(req: Request, res: Response) {
  try {
    const { question, injuryId } = req.body;

    if (typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({
        error: 'Question is required',
      });
    }

    if (
      injuryId !== undefined &&
      (!Number.isSafeInteger(injuryId) ||
        injuryId <= 0 ||
        injuryId > 2_147_483_647)
    ) {
      return res.status(400).json({
        error: 'Invalid injuryId',
      });
    }

    const result = await runAgent(question, injuryId);

    return res.json(result);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: 'Failed to process request',
    });
  }
}
