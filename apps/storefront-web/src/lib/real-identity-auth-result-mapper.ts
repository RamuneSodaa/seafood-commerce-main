import type { AuthSuccessResult } from '../../../../packages/shared-types/src';
import { DEFAULT_STOREFRONT_CUSTOMER_ROLE } from './config';
import { type StoredRealCustomerIdentity } from './identity-storage';

export type StorefrontAuthResultProvider = 'wechat' | 'mock';

export type StorefrontAuthSuccessResult = AuthSuccessResult & {
  provider: StorefrontAuthResultProvider;
  role?: typeof DEFAULT_STOREFRONT_CUSTOMER_ROLE;
};

export type StorefrontMappedRealIdentityResult = {
  provider: StorefrontAuthResultProvider;
  realIdentity: StoredRealCustomerIdentity;
};

export function mapStorefrontAuthSuccessResultToRealIdentity(
  authResult: StorefrontAuthSuccessResult
): StorefrontMappedRealIdentityResult {
  const trimmedUserId = authResult.userId.trim();

  if (!trimmedUserId) {
    throw new Error('Missing auth result userId');
  }

  return {
    provider: authResult.provider,
    realIdentity: {
      role: authResult.role || DEFAULT_STOREFRONT_CUSTOMER_ROLE,
      userId: trimmedUserId
    }
  };
}
