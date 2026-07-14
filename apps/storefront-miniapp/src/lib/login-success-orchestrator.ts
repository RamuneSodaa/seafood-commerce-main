import {
  mapMiniappAuthSuccessResultToRealIdentity,
  type MiniappAuthSuccessResult
} from './real-identity-auth-result-mapper';
import {
  writeMiniappRealIdentityAfterLoginSuccess,
  type MiniappRealIdentityWriteResult
} from './real-identity-write-adapter';

export type MiniappLoginSuccessPipelineResult = MiniappRealIdentityWriteResult & {
  provider: MiniappAuthSuccessResult['provider'];
};

export function handleMiniappLoginSuccess(
  authResult: MiniappAuthSuccessResult
): MiniappLoginSuccessPipelineResult {
  const mappedResult = mapMiniappAuthSuccessResultToRealIdentity(authResult);
  const writeResult = writeMiniappRealIdentityAfterLoginSuccess(mappedResult.realIdentity);

  return {
    provider: mappedResult.provider,
    ...writeResult
  };
}
