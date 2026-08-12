import { createHash, randomBytes } from 'crypto';

/** Generates a random URL-safe token plus its SHA-256 hash for at-rest storage. */
export function generateToken() {
  const token = randomBytes(32).toString('hex');
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
