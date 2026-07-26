import {
  mapStorefrontAuthSuccessResultToRealIdentity,
  type StorefrontAuthSuccessResult
} from './real-identity-auth-result-mapper';
import {
  writeStorefrontRealIdentityAfterLoginSuccess,
  type StorefrontRealIdentityWriteResult
} from './real-identity-write-adapter';
import {
  clearStoredCustomerAuthArtifact,
  setStoredCustomerAuthArtifact
} from './identity-storage';

export type StorefrontLoginSuccessPipelineResult = StorefrontRealIdentityWriteResult & {
  provider: StorefrontAuthSuccessResult['provider'];
};

export function handleStorefrontLoginSuccess(
  authResult: StorefrontAuthSuccessResult
): StorefrontLoginSuccessPipelineResult {
  const mappedResult = mapStorefrontAuthSuccessResultToRealIdentity(authResult);

  if (mappedResult.authArtifact) {
    setStoredCustomerAuthArtifact(mappedResult.authArtifact);
  } else {
    clearStoredCustomerAuthArtifact();
  }

  const writeResult = writeStorefrontRealIdentityAfterLoginSuccess(mappedResult.realIdentity);

  return {
    provider: mappedResult.provider,
    ...writeResult
  };
}
