import { randomUUID } from 'node:crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import Groq from 'groq-sdk';
import { runAgent } from './ai-agent-orchestrator.js';
import { logError } from '../lib/log-error.js';
import { sendError } from '../lib/api-error.js';
import { EmbeddingServiceError } from '../embeddings/embedding-client.js';

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
          return sendError(
            res,
            400,
            'question_too_long',
            `Question exceeds maximum length of ${MAX_QUESTION_LENGTH} characters`,
          );
        }

        return sendError(res, 400, 'question_required', 'Question is required');
      }

      const injuryIdIssue = parsed.error.issues.find(
        (issue) => issue.path[0] === 'injuryId',
      );

      if (injuryIdIssue) {
        return sendError(res, 400, 'invalid_injury_id', 'Invalid injuryId');
      }

      // Root-level type mismatch (e.g. a non-object JSON body like a bare
      // string or array) -- neither field can be resolved, so report the
      // same "missing question" error the old ad hoc checks gave for this case.
      return sendError(res, 400, 'question_required', 'Question is required');
    }

    const { question, injuryId } = parsed.data;

    if (req.userId === undefined) {
      return sendError(res, 401, 'authentication_required', 'Authentication required');
    }

    const result = await runAgent(question, req.userId, injuryId, requestId);

    return res.json(result);
  } catch (error) {
    logError('ai-agent request failed', error);

    if (error instanceof EmbeddingServiceError) {
      return sendError(res, 500, 'embedding_service_error', 'Failed to process request');
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError ||
      error instanceof Prisma.PrismaClientInitializationError
    ) {
      return sendError(res, 500, 'database_error', 'Failed to process request');
    }

    if (error instanceof Groq.APIError) {
      return sendError(res, 500, 'llm_service_error', 'Failed to process request');
    }

    return sendError(res, 500, 'internal_error', 'Failed to process request');
  }
}
