import { decryptSecret, encryptSecret } from './crypto.util';

describe('token encryption', () => {
  const original = process.env.TOKEN_ENCRYPTION_KEY;
  beforeAll(() => {
    process.env.TOKEN_ENCRYPTION_KEY = 'test-key-for-specs';
  });
  afterAll(() => {
    process.env.TOKEN_ENCRYPTION_KEY = original;
  });

  it('round-trips a token', () => {
    const token = 'EAAG...a-real-looking-access-token';
    expect(decryptSecret(encryptSecret(token))).toBe(token);
  });

  it('never stores the token in readable form', () => {
    const token = 'super-secret-value';
    expect(encryptSecret(token)).not.toContain(token);
  });

  it('produces a different ciphertext each time, so equal tokens are not linkable', () => {
    expect(encryptSecret('same')).not.toBe(encryptSecret('same'));
  });

  it('refuses to decrypt tampered data rather than returning garbage', () => {
    const encrypted = Buffer.from(encryptSecret('value'), 'base64');
    encrypted[encrypted.length - 1] ^= 0xff;
    expect(() => decryptSecret(encrypted.toString('base64'))).toThrow();
  });

  it('fails loudly when no key is configured', () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    expect(() => encryptSecret('value')).toThrow(/TOKEN_ENCRYPTION_KEY/);
    process.env.TOKEN_ENCRYPTION_KEY = 'test-key-for-specs';
  });
});
