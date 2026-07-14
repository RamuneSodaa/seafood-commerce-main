import {
  clearStoredPlaceholderCustomerIdentity,
  getStoredRealCustomerIdentity,
  setStoredRealCustomerIdentity,
  type StoredRealCustomerIdentity
} from './identity-storage';
import { resolveMiniappIdentity, type ResolvedMiniappIdentity } from './identity';

export type MiniappRealIdentityWriteResult = {
  resolvedIdentity: ResolvedMiniappIdentity;
  storedRealIdentity: StoredRealCustomerIdentity | null;
};

export function writeMiniappRealIdentityAfterLoginSuccess(
  identity: StoredRealCustomerIdentity
): MiniappRealIdentityWriteResult {
  setStoredRealCustomerIdentity(identity);
  clearStoredPlaceholderCustomerIdentity();

  return {
    resolvedIdentity: resolveMiniappIdentity(),
    storedRealIdentity: getStoredRealCustomerIdentity()
  };
}
