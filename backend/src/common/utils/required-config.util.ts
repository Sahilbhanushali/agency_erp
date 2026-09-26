/**
 * Config the app cannot work without. These are read with getOrThrow deep inside
 * request handling, where a missing key surfaces as a 500 partway through an
 * operation — after a row has already been written. Checking at boot turns that
 * into one loud startup failure instead.
 */
export const REQUIRED_ENV_KEYS = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'GMAIL_USER',
  'GMAIL_APP_PASSWORD',
  'FRONTEND_ORIGIN',
] as const;

export function assertRequiredConfig(env: NodeJS.ProcessEnv) {
  const missing = REQUIRED_ENV_KEYS.filter((key) => !env[key]?.trim());
  if (missing.length === 0) return;

  throw new Error(
    [
      `Missing required environment variable${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}.`,
      'Copy backend/.env.example to backend/.env and fill these in before starting.',
    ].join(' '),
  );
}
