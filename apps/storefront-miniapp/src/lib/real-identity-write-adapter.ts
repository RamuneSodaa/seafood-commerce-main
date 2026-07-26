import {
  getStoredRealCustomerIdentity,
  replaceStoredVerifiedCustomerSession,
  type StoredRealCustomerIdentity
} from './identity-storage';
import {
  resolveMiniappIdentity,
  type ResolvedMiniappIdentity
} from './identity';

export type MiniappRealIdentityWriteResult = {
  resolvedIdentity: ResolvedMiniappIdentity;
  storedRealIdentity: StoredRealCustomerIdentity | null;
};

export function writeMiniappRealIdentityAfterLoginSuccess(
  identity: StoredRealCustomerIdentity,
  authArtifact: string
): MiniappRealIdentityWriteResult {
  replaceStoredVerifiedCustomerSession(
    identity,
    authArtifact
  );

  return {
    resolvedIdentity: resolveMiniappIdentity(),
    storedRealIdentity: getStoredRealCustomerIdentity()
  };
}
