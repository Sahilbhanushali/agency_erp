import { connectionState } from './connection-state';

const hour = 60 * 60 * 1000;

describe('connectionState', () => {
  it('is NOT_CONNECTED when the account is only registered, never authorised', () => {
    expect(
      connectionState({
        isActive: true,
        accessToken: '',
        tokenExpiresAt: null,
      }),
    ).toBe('NOT_CONNECTED');
  });

  it('is CONNECTED with a live token', () => {
    expect(
      connectionState({
        isActive: true,
        accessToken: 'cipher',
        tokenExpiresAt: new Date(Date.now() + hour),
      }),
    ).toBe('CONNECTED');
  });

  it('is CONNECTED when a token carries no expiry', () => {
    expect(
      connectionState({
        isActive: true,
        accessToken: 'cipher',
        tokenExpiresAt: null,
      }),
    ).toBe('CONNECTED');
  });

  it('is EXPIRED the moment the token lapses, not merely when a call fails', () => {
    expect(
      connectionState({
        isActive: true,
        accessToken: 'cipher',
        tokenExpiresAt: new Date(Date.now() - 1000),
      }),
    ).toBe('EXPIRED');
  });

  it('reports DISCONNECTED ahead of any token state once switched off', () => {
    expect(
      connectionState({
        isActive: false,
        accessToken: 'cipher',
        tokenExpiresAt: new Date(Date.now() + hour),
      }),
    ).toBe('DISCONNECTED');
  });
});
