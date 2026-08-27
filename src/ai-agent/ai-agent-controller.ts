import { randomUUID } from 'node:crypto';
import { Request, Response } from 'express';
import { runAgent } from './ai-agent-orchestrator.js';

export async function askAgent(req: Request, res: Response) {
  try {
    const headerRequestId = req.headers?.['x-request-id'];
    const requestId =
      typeof headerRequestId === 'string' && headerRequestId.trim().length > 0
        ? headerRequestId
        : randomUUID();

    const { question, injuryId } = req.body ?? {};

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

    const result = await runAgent(question, injuryId, requestId);

    return res.json(result);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: 'Failed to process request',
    });
  }
}
