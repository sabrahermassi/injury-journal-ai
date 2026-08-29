import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { logError } from '../lib/log-error.js';
import { sendError } from '../lib/api-error.js';

/**
 * TEMPORARY, and a deliberate deviation from `docs/02-architecture.md` D10.
 *
 * D10 keeps this repo AI/RAG-only and assigns identity/listing endpoints to the
 * separate journal application. This endpoint exists only so the local frontend
 * can offer an injury picker instead of asking the user to type a raw database
 * id. The main application's own `GET /injuries` supersedes it once the two
 * applications merge, at which point this whole module should be deleted --
 * tracked in #195, and noted in D10 and `docs/05-api-contract.md` §6.
 */
export async function listInjuries(req: Request, res: Response) {
  try {
    if (req.userId === undefined) {
      return sendError(res, 401, 'authentication_required', 'Authentication required');
    }

    const injuries = await prisma.injury.findMany({
      where: { userId: req.userId },
      select: {
        id: true,
        name: true,
        bodyArea: true,
        side: true,
      },
      orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
    });

    return res.json({ injuries });
  } catch (error) {
    logError('injuries request failed', error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError ||
      error instanceof Prisma.PrismaClientInitializationError
    ) {
      return sendError(res, 500, 'database_error', 'Failed to process request');
    }

    return sendError(res, 500, 'internal_error', 'Failed to process request');
  }
}
