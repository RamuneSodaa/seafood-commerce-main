import Taro from '@tarojs/taro';

import {
  DEFAULT_CUSTOMER_ROLE,
  MINIAPP_CUSTOMER_IDENTITY_STORAGE_KEY,
  MINIAPP_CUSTOMER_AUTH_ARTIFACT_STORAGE_KEY,
  MINIAPP_REAL_CUSTOMER_IDENTITY_STORAGE_KEY
} from './config';

const PENDING_INVITE_CODE_STORAGE_KEY = 'GREENSHANHUI_PENDING_INVITE_CODE';

export type StoredCustomerIdentity = {
  role: typeof DEFAULT_CUSTOMER_ROLE;
  userId: string;
};

export type StoredPlaceholderCustomerIdentity = StoredCustomerIdentity;
export type StoredRealCustomerIdentity = StoredCustomerIdentity;
export type StoredCustomerAuthArtifact = string;

export type StoredVerifiedCustomerSession = {
  identity: StoredRealCustomerIdentity;
  authArtifact: StoredCustomerAuthArtifact;
};

function normalizeStoredCustomerIdentity(value: unknown): StoredCustomerIdentity | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<StoredCustomerIdentity>;
  if (candidate.role !== DEFAULT_CUSTOMER_ROLE) {
    return null;
  }

  const userId = candidate.userId?.trim();
  if (!userId) {
    return null;
  }

  return {
    role: DEFAULT_CUSTOMER_ROLE,
    userId
  };
}

function normalizeStoredAuthArtifact(value: unknown): StoredCustomerAuthArtifact | null {
  if (typeof value !== 'string') {
    return null;
  }

  const artifact = value.trim();
  const parts = artifact.split('.');

  if (!artifact || parts.length !== 2 || !parts[0] || !parts[1]) {
    return null;
  }

  return artifact;
}

function getStoredIdentityByKey(storageKey: string): StoredCustomerIdentity | null {
  try {
    const storedValue = Taro.getStorageSync(storageKey) as unknown;
    return normalizeStoredCustomerIdentity(storedValue);
  } catch {
    return null;
  }
}

function setStoredIdentityByKey(storageKey: string, identity: StoredCustomerIdentity) {
  const normalizedIdentity = normalizeStoredCustomerIdentity(identity);

  if (!normalizedIdentity) {
    throw new Error('Invalid customer identity');
  }

  Taro.setStorageSync(storageKey, normalizedIdentity);
}

function clearStoredIdentityByKey(storageKey: string) {
  Taro.removeStorageSync(storageKey);
}

export function getStoredPlaceholderCustomerIdentity(): StoredPlaceholderCustomerIdentity | null {
  return getStoredIdentityByKey(MINIAPP_CUSTOMER_IDENTITY_STORAGE_KEY);
}

export function setStoredPlaceholderCustomerIdentity(identity: StoredPlaceholderCustomerIdentity) {
  setStoredIdentityByKey(MINIAPP_CUSTOMER_IDENTITY_STORAGE_KEY, identity);
}

export function clearStoredPlaceholderCustomerIdentity() {
  clearStoredIdentityByKey(MINIAPP_CUSTOMER_IDENTITY_STORAGE_KEY);
}

export function getStoredRealCustomerIdentity(): StoredRealCustomerIdentity | null {
  return getStoredIdentityByKey(MINIAPP_REAL_CUSTOMER_IDENTITY_STORAGE_KEY);
}

export function clearStoredRealCustomerIdentity() {
  clearStoredIdentityByKey(MINIAPP_REAL_CUSTOMER_IDENTITY_STORAGE_KEY);
}

export function getStoredCustomerAuthArtifact(): StoredCustomerAuthArtifact | null {
  try {
    const storedValue = Taro.getStorageSync(
      MINIAPP_CUSTOMER_AUTH_ARTIFACT_STORAGE_KEY
    ) as unknown;

    return normalizeStoredAuthArtifact(storedValue);
  } catch {
    return null;
  }
}

export function setStoredCustomerAuthArtifact(authArtifact: string) {
  const normalizedArtifact = normalizeStoredAuthArtifact(authArtifact);

  if (!normalizedArtifact) {
    clearStoredCustomerAuthArtifact();
    throw new Error('Invalid customer auth artifact');
  }

  Taro.setStorageSync(
    MINIAPP_CUSTOMER_AUTH_ARTIFACT_STORAGE_KEY,
    normalizedArtifact
  );
}

export function clearStoredCustomerAuthArtifact() {
  Taro.removeStorageSync(MINIAPP_CUSTOMER_AUTH_ARTIFACT_STORAGE_KEY);
}

export function clearAllStoredCustomerIdentities() {
  clearStoredCustomerAuthArtifact();
  clearStoredRealCustomerIdentity();
  clearStoredPlaceholderCustomerIdentity();
}

export function replaceStoredVerifiedCustomerSession(
  identity: StoredRealCustomerIdentity,
  authArtifact: string
): StoredVerifiedCustomerSession {
  const normalizedIdentity = normalizeStoredCustomerIdentity(identity);
  const normalizedArtifact = normalizeStoredAuthArtifact(authArtifact);

  if (!normalizedIdentity || !normalizedArtifact) {
    clearAllStoredCustomerIdentities();
    throw new Error('Invalid verified customer session');
  }

  clearAllStoredCustomerIdentities();

  try {
    Taro.setStorageSync(
      MINIAPP_REAL_CUSTOMER_IDENTITY_STORAGE_KEY,
      normalizedIdentity
    );
    Taro.setStorageSync(
      MINIAPP_CUSTOMER_AUTH_ARTIFACT_STORAGE_KEY,
      normalizedArtifact
    );

    const storedIdentity = getStoredRealCustomerIdentity();
    const storedArtifact = getStoredCustomerAuthArtifact();

    if (
      !storedIdentity ||
      storedIdentity.userId !== normalizedIdentity.userId ||
      storedIdentity.role !== normalizedIdentity.role ||
      storedArtifact !== normalizedArtifact
    ) {
      throw new Error('Customer session storage verification failed');
    }

    return {
      identity: storedIdentity,
      authArtifact: storedArtifact
    };
  } catch (error) {
    clearAllStoredCustomerIdentities();
    throw error;
  }
}

export function getStoredVerifiedCustomerSession(): StoredVerifiedCustomerSession | null {
  const identity = getStoredRealCustomerIdentity();
  const authArtifact = getStoredCustomerAuthArtifact();

  if (identity && authArtifact) {
    return {
      identity,
      authArtifact
    };
  }

  if (identity || authArtifact) {
    clearAllStoredCustomerIdentities();
  }

  return null;
}

export function getStoredCustomerIdentity(): StoredPlaceholderCustomerIdentity | null {
  return getStoredPlaceholderCustomerIdentity();
}

export function setStoredCustomerIdentity(identity: StoredPlaceholderCustomerIdentity) {
  setStoredPlaceholderCustomerIdentity(identity);
}

export function clearStoredCustomerIdentity() {
  clearStoredPlaceholderCustomerIdentity();
}

export function getPendingInviteCode(): string | null {
  try {
    const storedValue = Taro.getStorageSync(PENDING_INVITE_CODE_STORAGE_KEY) as unknown;
    return typeof storedValue === 'string' && storedValue.trim() ? storedValue.trim() : null;
  } catch {
    return null;
  }
}

export function setPendingInviteCode(inviteCode: string) {
  const normalizedInviteCode = inviteCode.trim();
  if (!normalizedInviteCode) return;

  Taro.setStorageSync(PENDING_INVITE_CODE_STORAGE_KEY, normalizedInviteCode);
}

export function clearPendingInviteCode() {
  Taro.removeStorageSync(PENDING_INVITE_CODE_STORAGE_KEY);
}
