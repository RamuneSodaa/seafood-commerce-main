import type { AuthSuccessResult } from '../../../../packages/shared-types/src';
import { DEFAULT_CUSTOMER_ROLE } from './config';
import { type StoredRealCustomerIdentity } from './identity-storage';

export type MiniappAuthResultProvider = 'wechat';

export type MiniappAuthSuccessResult = AuthSuccessResult & {
  authArtifact: string;
};

export type MiniappMappedRealIdentityResult = {
  provider: MiniappAuthResultProvider;
  realIdentity: StoredRealCustomerIdentity;
  authArtifact: string;
};

function normalizeAuthArtifact(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Missing authArtifact');
  }

  const authArtifact = value.trim();
  const parts = authArtifact.split('.');

  if (!authArtifact || parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error('Invalid authArtifact');
  }

  return authArtifact;
}

export function mapMiniappAuthSuccessResultToRealIdentity(
  authResult: MiniappAuthSuccessResult
): MiniappMappedRealIdentityResult {
  if (authResult.provider !== 'wechat') {
    throw new Error('Real customer login requires provider wechat');
  }

  if (
    authResult.role !== undefined &&
    authResult.role !== DEFAULT_CUSTOMER_ROLE
  ) {
    throw new Error('Invalid auth result role');
  }

  const trimmedUserId = authResult.userId.trim();

  if (!trimmedUserId) {
    throw new Error('Missing auth result userId');
  }

  return {
    provider: 'wechat',
    realIdentity: {
      role: DEFAULT_CUSTOMER_ROLE,
      userId: trimmedUserId
    },
    authArtifact: normalizeAuthArtifact(authResult.authArtifact)
  };
}
