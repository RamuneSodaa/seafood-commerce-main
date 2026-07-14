import { CURRENT_STOREFRONT_PROFILE } from './config';
import {
  getStoredPlaceholderCustomerIdentity,
  getStoredRealCustomerIdentity
} from './identity-storage';

export type StorefrontIdentity = {
  role: 'CUSTOMER';
  userId: string;
};

export type StorefrontIdentitySource =
  | 'profile-env'
  | 'real-storage'
  | 'placeholder-storage'
  | 'demo-fallback';

export type ResolvedStorefrontIdentity = {
  identity: StorefrontIdentity;
  source: StorefrontIdentitySource;
};

function hasExplicitProfileIdentity(): boolean {
  return CURRENT_STOREFRONT_PROFILE.name !== 'demo' || Boolean(process.env.NEXT_PUBLIC_STOREFRONT_CUSTOMER_USER_ID?.trim());
}

export function isStorefrontIdentityStorageOverridden(): boolean {
  return resolveStorefrontIdentity().source === 'profile-env';
}

export function resolveStorefrontIdentity(): ResolvedStorefrontIdentity {
  if (hasExplicitProfileIdentity()) {
    return {
      identity: CURRENT_STOREFRONT_PROFILE.customerIdentity,
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
    identity: CURRENT_STOREFRONT_PROFILE.customerIdentity,
    source: 'demo-fallback'
  };
}

export function getStorefrontIdentitySource(): StorefrontIdentitySource {
  return resolveStorefrontIdentity().source;
}

export function getStorefrontIdentity(): StorefrontIdentity {
  return resolveStorefrontIdentity().identity;
}
