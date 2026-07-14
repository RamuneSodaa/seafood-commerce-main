import type { AuthSuccessResult } from '../../../../packages/shared-types/src';
import { DEFAULT_CUSTOMER_ROLE } from './config';
import { type StoredRealCustomerIdentity } from './identity-storage';

export type MiniappAuthResultProvider = 'wechat' | 'mock';

export type MiniappAuthSuccessResult = AuthSuccessResult & {
  provider: MiniappAuthResultProvider;
  role?: typeof DEFAULT_CUSTOMER_ROLE;
};

export type MiniappMappedRealIdentityResult = {
  provider: MiniappAuthResultProvider;
  realIdentity: StoredRealCustomerIdentity;
};

export function mapMiniappAuthSuccessResultToRealIdentity(
  authResult: MiniappAuthSuccessResult
): MiniappMappedRealIdentityResult {
  const trimmedUserId = authResult.userId.trim();

  if (!trimmedUserId) {
    throw new Error('Missing auth result userId');
  }

  return {
    provider: authResult.provider,
    realIdentity: {
      role: authResult.role || DEFAULT_CUSTOMER_ROLE,
      userId: trimmedUserId
    }
  };
}
