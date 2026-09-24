/**
 * What a social account's credentials are actually worth right now.
 *
 * CONNECTING is absent: it only exists while an OAuth redirect is in flight, and
 * there is no OAuth flow yet. It lands with the first real provider.
 */
export type ConnectionState =
  'NOT_CONNECTED' | 'CONNECTED' | 'EXPIRED' | 'DISCONNECTED';

interface ConnectionInput {
  isActive: boolean;
  accessToken: string;
  tokenExpiresAt: Date | null;
}

export function connectionState(account: ConnectionInput): ConnectionState {
  if (!account.isActive) return 'DISCONNECTED';
  if (!account.accessToken) return 'NOT_CONNECTED';
  if (
    account.tokenExpiresAt &&
    account.tokenExpiresAt.getTime() <= Date.now()
  ) {
    return 'EXPIRED';
  }
  return 'CONNECTED';
}
