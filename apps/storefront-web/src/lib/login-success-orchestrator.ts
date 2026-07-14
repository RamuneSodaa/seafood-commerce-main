import {
  mapStorefrontAuthSuccessResultToRealIdentity,
  type StorefrontAuthSuccessResult
} from './real-identity-auth-result-mapper';
import {
  writeStorefrontRealIdentityAfterLoginSuccess,
  type StorefrontRealIdentityWriteResult
} from './real-identity-write-adapter';

export type StorefrontLoginSuccessPipelineResult = StorefrontRealIdentityWriteResult & {
  provider: StorefrontAuthSuccessResult['provider'];
};

export function handleStorefrontLoginSuccess(
  authResult: StorefrontAuthSuccessResult
): StorefrontLoginSuccessPipelineResult {
  const mappedResult = mapStorefrontAuthSuccessResultToRealIdentity(authResult);
  const writeResult = writeStorefrontRealIdentityAfterLoginSuccess(mappedResult.realIdentity);

  return {
    provider: mappedResult.provider,
    ...writeResult
  };
}
