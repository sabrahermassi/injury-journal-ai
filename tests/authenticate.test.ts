import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { authenticate } from '../src/auth/authenticate.js';
import {
  signNoneAlgToken,
  signRS256Token,
  signTestTokenNoExpiry,
} from './helpers/auth.js';

type MockRequest = {
  headers: Record<string, string | undefined>;
  userId?: number;
};
type MockResponse = {
  status: jest.Mock;
  json: jest.Mock;
};

function mockResponse(): MockResponse {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

const SECRET = 'unit-test-secret';

describe('authenticate middleware', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, JWT_SECRET: SECRET };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns 401 when the Authorization header is missing', () => {
    const req: MockRequest = { headers: {} };
    const res = mockResponse();
    const next = jest.fn();

    authenticate(req as never, res as never, next as never);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Authentication required',
      code: 'authentication_required',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when the Authorization header is malformed', () => {
    const req: MockRequest = { headers: { authorization: 'Basic abc123' } };
    const res = mockResponse();
    const next = jest.fn();

    authenticate(req as never, res as never, next as never);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Authentication required',
      code: 'authentication_required',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for an invalid signature', () => {
    const token = jwt.sign({ sub: '1' }, 'wrong-secret', {
      algorithm: 'HS256',
    });
    const req: MockRequest = { headers: { authorization: `Bearer ${token}` } };
    const res = mockResponse();
    const next = jest.fn();

    authenticate(req as never, res as never, next as never);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid or expired token',
      code: 'invalid_token',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for an expired token', () => {
    const token = jwt.sign({ sub: '1' }, SECRET, {
      algorithm: 'HS256',
      expiresIn: -10,
    });
    const req: MockRequest = { headers: { authorization: `Bearer ${token}` } };
    const res = mockResponse();
    const next = jest.fn();

    authenticate(req as never, res as never, next as never);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid or expired token',
      code: 'invalid_token',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when the sub claim is not a valid positive integer', () => {
    const token = jwt.sign({ sub: 'not-a-number' }, SECRET, {
      algorithm: 'HS256',
    });
    const req: MockRequest = { headers: { authorization: `Bearer ${token}` } };
    const res = mockResponse();
    const next = jest.fn();

    authenticate(req as never, res as never, next as never);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid or expired token',
      code: 'invalid_token',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts a lowercase "bearer" scheme (RFC 7235 is case-insensitive)', () => {
    const token = jwt.sign({ sub: '42' }, SECRET, { algorithm: 'HS256' });
    const req: MockRequest = { headers: { authorization: `bearer ${token}` } };
    const res = mockResponse();
    const next = jest.fn();

    authenticate(req as never, res as never, next as never);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.userId).toBe(42);
  });

  it('accepts extra whitespace between the scheme and the token', () => {
    const token = jwt.sign({ sub: '42' }, SECRET, { algorithm: 'HS256' });
    const req: MockRequest = { headers: { authorization: `Bearer   ${token}` } };
    const res = mockResponse();
    const next = jest.fn();

    authenticate(req as never, res as never, next as never);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.userId).toBe(42);
  });

  it('rejects a header with trailing content after the token', () => {
    const token = jwt.sign({ sub: '42' }, SECRET, { algorithm: 'HS256' });
    const req: MockRequest = {
      headers: { authorization: `Bearer ${token} extra` },
    };
    const res = mockResponse();
    const next = jest.fn();

    authenticate(req as never, res as never, next as never);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Authentication required',
      code: 'authentication_required',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() and sets req.userId for a valid token', () => {
    const token = jwt.sign({ sub: '42' }, SECRET, { algorithm: 'HS256' });
    const req: MockRequest = { headers: { authorization: `Bearer ${token}` } };
    const res = mockResponse();
    const next = jest.fn();

    authenticate(req as never, res as never, next as never);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(req.userId).toBe(42);
  });

  it('returns 401 for a token signed with alg "none"', () => {
    const token = signNoneAlgToken(1);
    const req: MockRequest = { headers: { authorization: `Bearer ${token}` } };
    const res = mockResponse();
    const next = jest.fn();

    authenticate(req as never, res as never, next as never);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid or expired token',
      code: 'invalid_token',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for an RS256-signed token (algorithm allowlist rejects it)', () => {
    const token = signRS256Token(1);
    const req: MockRequest = { headers: { authorization: `Bearer ${token}` } };
    const res = mockResponse();
    const next = jest.fn();

    authenticate(req as never, res as never, next as never);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid or expired token',
      code: 'invalid_token',
    });
    expect(next).not.toHaveBeenCalled();
  });

  // jwt.verify does not require an `exp` claim, so a token without one is
  // currently accepted indefinitely. This documents that assumption (the
  // external issuer is trusted to always set `exp`) rather than treating it
  // as untested behavior.
  it('accepts a token with no exp claim (documents current unbounded lifetime)', () => {
    const token = signTestTokenNoExpiry(42);
    const req: MockRequest = { headers: { authorization: `Bearer ${token}` } };
    const res = mockResponse();
    const next = jest.fn();

    authenticate(req as never, res as never, next as never);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(req.userId).toBe(42);
  });

  it('returns 500 when JWT_SECRET is not configured', () => {
    delete process.env.JWT_SECRET;

    const req: MockRequest = { headers: { authorization: 'Bearer whatever' } };
    const res = mockResponse();
    const next = jest.fn();

    authenticate(req as never, res as never, next as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Failed to process request',
      code: 'internal_error',
    });
    expect(next).not.toHaveBeenCalled();
  });
});
