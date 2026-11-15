import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
// Legacy: still read for SMTP passwords. Credentials use lib/credentials/vault.ts.
// No fallback key: with NEXTAUTH_SECRET unset, the old code encrypted everything under
// a constant published in this file.
function secretKey(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET is not set; refusing to use a built-in key');
  return crypto.createHash('sha256').update(secret).digest('base64').substr(0, 32);
}

export function encrypt(text: string): string {
  if (!text) return text;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(secretKey()), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text: string): string {
  if (!text) return text;
  if (!text.includes(':')) return text; // Fallback for unencrypted old data
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift() as string, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(secretKey()), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error('Decryption failed', error);
    return text;
  }
}
