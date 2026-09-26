import { InternalServerErrorException } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

/**
 * Derived from the env secret so any length of passphrase yields a 32-byte key.
 * Absent key throws at use rather than at boot, so the rest of the app still runs
 * on an install that has not configured social publishing yet.
 */
function key() {
  const secret = process.env.TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new InternalServerErrorException(
      'TOKEN_ENCRYPTION_KEY is not configured; cannot store platform credentials.',
    );
  }
  return createHash('sha256').update(secret).digest();
}

/** iv | authTag | ciphertext, base64. Authenticated, so tampering fails to decrypt. */
export function encryptSecret(plainText: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}

export function decryptSecret(payload: string): string {
  const raw = Buffer.from(payload, 'base64');
  const iv = raw.subarray(0, IV_BYTES);
  const authTag = raw.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
  const encrypted = raw.subarray(IV_BYTES + AUTH_TAG_BYTES);

  const decipher = createDecipheriv(ALGORITHM, key(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    'utf8',
  );
}
