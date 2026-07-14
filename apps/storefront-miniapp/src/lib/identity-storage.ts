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
    return;
  }

  Taro.setStorageSync(storageKey, normalizedIdentity);
}

function clearStoredIdentityByKey(storageKey: string) {
  Taro.removeStorageSync(storageKey);
}

function normalizeStoredAuthArtifact(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const artifact = value.trim();
  return artifact || null;
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

export function setStoredRealCustomerIdentity(identity: StoredRealCustomerIdentity) {
  setStoredIdentityByKey(MINIAPP_REAL_CUSTOMER_IDENTITY_STORAGE_KEY, identity);
}

export function clearStoredRealCustomerIdentity() {
  clearStoredIdentityByKey(MINIAPP_REAL_CUSTOMER_IDENTITY_STORAGE_KEY);
}

export function getStoredCustomerAuthArtifact(): string | null {
  try {
    const storedValue = Taro.getStorageSync(MINIAPP_CUSTOMER_AUTH_ARTIFACT_STORAGE_KEY) as unknown;
    return normalizeStoredAuthArtifact(storedValue);
  } catch {
    return null;
  }
}

export function setStoredCustomerAuthArtifact(authArtifact: string) {
  const normalizedArtifact = normalizeStoredAuthArtifact(authArtifact);
  if (!normalizedArtifact) {
    return;
  }

  Taro.setStorageSync(MINIAPP_CUSTOMER_AUTH_ARTIFACT_STORAGE_KEY, normalizedArtifact);
}

export function clearStoredCustomerAuthArtifact() {
  Taro.removeStorageSync(MINIAPP_CUSTOMER_AUTH_ARTIFACT_STORAGE_KEY);
}

export function clearAllStoredCustomerIdentities() {
  clearStoredRealCustomerIdentity();
  clearStoredPlaceholderCustomerIdentity();
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
