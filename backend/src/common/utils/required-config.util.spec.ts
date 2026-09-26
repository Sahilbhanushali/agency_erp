import { assertRequiredConfig, REQUIRED_ENV_KEYS } from './required-config.util';

const complete = Object.fromEntries(
  REQUIRED_ENV_KEYS.map((key) => [key, 'set']),
) as NodeJS.ProcessEnv;

describe('assertRequiredConfig', () => {
  it('passes when everything is set', () => {
    expect(() => assertRequiredConfig(complete)).not.toThrow();
  });

  it('names the missing key so the fix is obvious', () => {
    const { FRONTEND_ORIGIN: _omitted, ...rest } = complete;
    expect(() => assertRequiredConfig(rest)).toThrow(/FRONTEND_ORIGIN/);
  });

  it('lists every missing key at once, not just the first', () => {
    expect(() => assertRequiredConfig({})).toThrow(
      new RegExp(REQUIRED_ENV_KEYS.join('.*')),
    );
  });

  it('treats a blank value as missing, since it is', () => {
    expect(() =>
      assertRequiredConfig({ ...complete, FRONTEND_ORIGIN: '   ' }),
    ).toThrow(/FRONTEND_ORIGIN/);
  });
});
