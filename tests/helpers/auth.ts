import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

export function signTestToken(userId: number): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET must be set to sign a test token');
  }

  return jwt.sign({ sub: String(userId) }, secret, {
    algorithm: 'HS256',
    expiresIn: '1h',
  });
}

export function signTestTokenNoExpiry(userId: number): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET must be set to sign a test token');
  }

  return jwt.sign({ sub: String(userId) }, secret, { algorithm: 'HS256' });
}

export function signNoneAlgToken(userId: number): string {
  return jwt.sign({ sub: String(userId) }, '', { algorithm: 'none' });
}

export function signRS256Token(userId: number): string {
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });

  return jwt.sign({ sub: String(userId) }, privateKey, {
    algorithm: 'RS256',
  });
}
