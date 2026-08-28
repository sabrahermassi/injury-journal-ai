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
