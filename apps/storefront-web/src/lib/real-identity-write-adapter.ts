import {
  clearStoredPlaceholderCustomerIdentity,
  getStoredRealCustomerIdentity,
  setStoredRealCustomerIdentity,
  type StoredRealCustomerIdentity
} from './identity-storage';
import { resolveStorefrontIdentity, type ResolvedStorefrontIdentity } from './identity';

export type StorefrontRealIdentityWriteResult = {
  resolvedIdentity: ResolvedStorefrontIdentity;
  storedRealIdentity: StoredRealCustomerIdentity | null;
};

export function writeStorefrontRealIdentityAfterLoginSuccess(
  identity: StoredRealCustomerIdentity
): StorefrontRealIdentityWriteResult {
  setStoredRealCustomerIdentity(identity);
  clearStoredPlaceholderCustomerIdentity();

  return {
    resolvedIdentity: resolveStorefrontIdentity(),
    storedRealIdentity: getStoredRealCustomerIdentity()
  };
}
