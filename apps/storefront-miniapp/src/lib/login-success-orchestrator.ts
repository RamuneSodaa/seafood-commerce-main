import type { AuthSuccessResult } from '../../../../packages/shared-types/src';
import { DEFAULT_CUSTOMER_ROLE } from './config';
import {
  clearAllStoredCustomerIdentities,
  getStoredPlaceholderCustomerIdentity,
  replaceStoredVerifiedCustomerSession,
  setStoredPlaceholderCustomerIdentity,
  type StoredPlaceholderCustomerIdentity,
  type StoredVerifiedCustomerSession
} from './identity-storage';
import {
  mapMiniappAuthSuccessResultToRealIdentity,
  type MiniappAuthSuccessResult
} from './real-identity-auth-result-mapper';
import {
  verifyCustomerAuthArtifact,
  type VerifiedCustomerAuthIdentity
} from './api';
import {
  resolveMiniappIdentity,
  type ResolvedMiniappIdentity
} from './identity';

export type MiniappLoginSuccessPipelineResult = {
  provider: 'wechat';
  resolvedIdentity: ResolvedMiniappIdentity;
  storedRealIdentity: StoredVerifiedCustomerSession['identity'];
  storedAuthArtifact: string;
  backendVerifiedIdentity: VerifiedCustomerAuthIdentity;
};

export type MiniappPlaceholderLoginResult = {
  provider: AuthSuccessResult['provider'];
  resolvedIdentity: ResolvedMiniappIdentity;
  storedPlaceholderIdentity: StoredPlaceholderCustomerIdentity;
};

function assertMatchingVerifiedIdentity(
  expectedUserId: string,
  verifiedIdentity: VerifiedCustomerAuthIdentity
) {
  if (
    verifiedIdentity.provider !== 'wechat' ||
    verifiedIdentity.role !== DEFAULT_CUSTOMER_ROLE ||
    verifiedIdentity.userId !== expectedUserId
  ) {
    throw new Error('Verified customer identity does not match auth exchange result');
  }
}

export async function handleMiniappLoginSuccess(
  authResult: MiniappAuthSuccessResult
): Promise<MiniappLoginSuccessPipelineResult> {
  const mappedResult = mapMiniappAuthSuccessResultToRealIdentity(authResult);

  clearAllStoredCustomerIdentities();

  try {
    const backendVerifiedIdentity = await verifyCustomerAuthArtifact(
      mappedResult.authArtifact
    );

    assertMatchingVerifiedIdentity(
      mappedResult.realIdentity.userId,
      backendVerifiedIdentity
    );

    const storedSession = replaceStoredVerifiedCustomerSession(
      mappedResult.realIdentity,
      mappedResult.authArtifact
    );
    const resolvedIdentity = resolveMiniappIdentity();

    if (
      resolvedIdentity.source !== 'real-storage' ||
      resolvedIdentity.identity.userId !== backendVerifiedIdentity.userId
    ) {
      throw new Error('Stored customer identity is inconsistent after login');
    }

    return {
      provider: mappedResult.provider,
      resolvedIdentity,
      storedRealIdentity: storedSession.identity,
      storedAuthArtifact: storedSession.authArtifact,
      backendVerifiedIdentity
    };
  } catch (error) {
    clearAllStoredCustomerIdentities();
    throw error;
  }
}

export function handleMiniappPlaceholderLoginSuccess(
  authResult: AuthSuccessResult
): MiniappPlaceholderLoginResult {
  const userId = authResult.userId.trim();

  if (!userId) {
    throw new Error('Missing placeholder auth result userId');
  }

  clearAllStoredCustomerIdentities();

  const identity: StoredPlaceholderCustomerIdentity = {
    role: DEFAULT_CUSTOMER_ROLE,
    userId
  };

  setStoredPlaceholderCustomerIdentity(identity);

  const storedPlaceholderIdentity = getStoredPlaceholderCustomerIdentity();

  if (!storedPlaceholderIdentity) {
    clearAllStoredCustomerIdentities();
    throw new Error('Placeholder identity storage failed');
  }

  return {
    provider: authResult.provider,
    resolvedIdentity: resolveMiniappIdentity(),
    storedPlaceholderIdentity
  };
}
