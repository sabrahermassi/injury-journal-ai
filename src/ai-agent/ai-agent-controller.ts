import { randomUUID } from 'node:crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import { runAgent } from './ai-agent-orchestrator.js';

// Mirrors EmbeddingRequest.text's own Field(max_length=10_000) in
// src/embeddings/embedding_api.py -- the question is what gets embedded.
const MAX_QUESTION_LENGTH = 10_000;

const askAgentSchema = z.object({
  question: z
    .string()
    .max(MAX_QUESTION_LENGTH)
    .refine((value) => value.trim().length > 0),
  injuryId: z.number().int().positive().max(2_147_483_647).optional(),
});

export async function askAgent(req: Request, res: Response) {
  try {
    const headerRequestId = req.headers?.['x-request-id'];
    const requestId =
      typeof headerRequestId === 'string' && headerRequestId.trim().length > 0
        ? headerRequestId
        : randomUUID();

    const parsed = askAgentSchema.safeParse(req.body ?? {});

    if (!parsed.success) {
      const questionIssue = parsed.error.issues.find(
        (issue) => issue.path[0] === 'question',
      );

      if (questionIssue) {
        if (questionIssue.code === 'too_big') {
          return res.status(400).json({
            error: `Question exceeds maximum length of ${MAX_QUESTION_LENGTH} characters`,
          });
        }

        return res.status(400).json({
          error: 'Question is required',
        });
      }

      const injuryIdIssue = parsed.error.issues.find(
        (issue) => issue.path[0] === 'injuryId',
      );

      if (injuryIdIssue) {
        return res.status(400).json({
          error: 'Invalid injuryId',
        });
      }

      // Root-level type mismatch (e.g. a non-object JSON body like a bare
      // string or array) -- neither field can be resolved, so report the
      // same "missing question" error the old ad hoc checks gave for this case.
      return res.status(400).json({
        error: 'Question is required',
      });
    }

    const { question, injuryId } = parsed.data;

    const result = await runAgent(question, injuryId, requestId);

    return res.json(result);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: 'Failed to process request',
    });
  }
}
