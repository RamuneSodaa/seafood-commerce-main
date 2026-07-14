import { CURRENT_MINIAPP_PROFILE, DEFAULT_CUSTOMER_ROLE } from './config';
import {
  getStoredPlaceholderCustomerIdentity,
  getStoredRealCustomerIdentity
} from './identity-storage';

export type MiniappIdentity = {
  role: typeof DEFAULT_CUSTOMER_ROLE;
  userId: string;
};

export type MiniappIdentitySource =
  | 'profile-env'
  | 'real-storage'
  | 'placeholder-storage'
  | 'demo-fallback';

export type ResolvedMiniappIdentity = {
  identity: MiniappIdentity;
  source: MiniappIdentitySource;
};

function hasExplicitProfileIdentity(): boolean {
  return CURRENT_MINIAPP_PROFILE.name !== 'demo' ||
    Boolean(process.env.TARO_APP_CUSTOMER_ROLE?.trim()) ||
    Boolean(process.env.TARO_APP_CUSTOMER_USER_ID?.trim());
}

export function isMiniappIdentityStorageOverridden(): boolean {
  return resolveMiniappIdentity().source === 'profile-env';
}

export function resolveMiniappIdentity(): ResolvedMiniappIdentity {
  if (hasExplicitProfileIdentity()) {
    return {
      identity: CURRENT_MINIAPP_PROFILE.customerIdentity,
      source: 'profile-env'
    };
  }

  const realIdentity = getStoredRealCustomerIdentity();
  if (realIdentity) {
    return {
      identity: realIdentity,
      source: 'real-storage'
    };
  }

  const placeholderIdentity = getStoredPlaceholderCustomerIdentity();
  if (placeholderIdentity) {
    return {
      identity: placeholderIdentity,
      source: 'placeholder-storage'
    };
  }

  return {
    identity: CURRENT_MINIAPP_PROFILE.customerIdentity,
    source: 'demo-fallback'
  };
}

export function getMiniappIdentitySource(): MiniappIdentitySource {
  return resolveMiniappIdentity().source;
}

export function getMiniappIdentity(): MiniappIdentity {
  return resolveMiniappIdentity().identity;
}
