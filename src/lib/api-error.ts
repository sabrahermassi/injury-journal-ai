import { Response } from 'express';

export type ApiErrorCode =
  | 'authentication_required'
  | 'invalid_token'
  | 'question_required'
  | 'question_too_long'
  | 'invalid_injury_id'
  | 'rate_limited'
  | 'embedding_service_error'
  | 'database_error'
  | 'llm_service_error'
  | 'internal_error';

export function sendError(
  res: Response,
  status: number,
  code: ApiErrorCode,
  message: string,
) {
  return res.status(status).json({ error: message, code });
}
