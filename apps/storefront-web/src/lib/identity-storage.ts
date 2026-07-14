import {
  DEFAULT_STOREFRONT_CUSTOMER_ROLE,
  STOREFRONT_CUSTOMER_IDENTITY_STORAGE_KEY,
  STOREFRONT_REAL_CUSTOMER_IDENTITY_STORAGE_KEY
} from './config';

export type StoredCustomerIdentity = {
  role: typeof DEFAULT_STOREFRONT_CUSTOMER_ROLE;
  userId: string;
};

export type StoredPlaceholderCustomerIdentity = StoredCustomerIdentity;
export type StoredRealCustomerIdentity = StoredCustomerIdentity;

function normalizeStoredCustomerIdentity(value: unknown): StoredCustomerIdentity | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<StoredCustomerIdentity>;
  if (candidate.role !== DEFAULT_STOREFRONT_CUSTOMER_ROLE) {
    return null;
  }

  const userId = candidate.userId?.trim();
  if (!userId) {
    return null;
  }

  return {
    role: DEFAULT_STOREFRONT_CUSTOMER_ROLE,
    userId
  };
}

function getStoredIdentityByKey(storageKey: string): StoredCustomerIdentity | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) {
      return null;
    }

    return normalizeStoredCustomerIdentity(JSON.parse(rawValue));
  } catch {
    return null;
  }
}

function setStoredIdentityByKey(storageKey: string, identity: StoredCustomerIdentity) {
  if (typeof window === 'undefined') {
    return;
  }

  const normalizedIdentity = normalizeStoredCustomerIdentity(identity);
  if (!normalizedIdentity) {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(normalizedIdentity));
}

function clearStoredIdentityByKey(storageKey: string) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(storageKey);
}

export function getStoredPlaceholderCustomerIdentity(): StoredPlaceholderCustomerIdentity | null {
  return getStoredIdentityByKey(STOREFRONT_CUSTOMER_IDENTITY_STORAGE_KEY);
}

export function setStoredPlaceholderCustomerIdentity(identity: StoredPlaceholderCustomerIdentity) {
  setStoredIdentityByKey(STOREFRONT_CUSTOMER_IDENTITY_STORAGE_KEY, identity);
}

export function clearStoredPlaceholderCustomerIdentity() {
  clearStoredIdentityByKey(STOREFRONT_CUSTOMER_IDENTITY_STORAGE_KEY);
}

export function getStoredRealCustomerIdentity(): StoredRealCustomerIdentity | null {
  return getStoredIdentityByKey(STOREFRONT_REAL_CUSTOMER_IDENTITY_STORAGE_KEY);
}

export function setStoredRealCustomerIdentity(identity: StoredRealCustomerIdentity) {
  setStoredIdentityByKey(STOREFRONT_REAL_CUSTOMER_IDENTITY_STORAGE_KEY, identity);
}

export function clearStoredRealCustomerIdentity() {
  clearStoredIdentityByKey(STOREFRONT_REAL_CUSTOMER_IDENTITY_STORAGE_KEY);
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
