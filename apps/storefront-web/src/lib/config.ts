export const DEFAULT_STOREFRONT_CUSTOMER_ROLE = 'CUSTOMER' as const;
export const DEFAULT_STOREFRONT_PAYMENT_MODE = 'mock' as const;
export const DEFAULT_STOREFRONT_PROFILE = 'demo' as const;
export const STOREFRONT_CUSTOMER_IDENTITY_STORAGE_KEY = 'seafood-storefront-customer-identity';
export const STOREFRONT_REAL_CUSTOMER_IDENTITY_STORAGE_KEY = 'seafood-storefront-real-customer-identity';

export type StorefrontProfileName = 'demo' | 'dev' | 'test';
export type StorefrontPaymentMode = 'mock' | 'wechat-placeholder';

type StorefrontCustomerIdentity = {
  role: typeof DEFAULT_STOREFRONT_CUSTOMER_ROLE;
  userId: string;
};

type StorefrontRuntimeProfile = {
  name: StorefrontProfileName;
  apiBaseUrl: string;
  customerIdentity: StorefrontCustomerIdentity;
  paymentMode: StorefrontPaymentMode;
};

function readConfiguredValue(value: string | undefined, fallback: string): string {
  const trimmedValue = value?.trim();
  return trimmedValue || fallback;
}

function readConfiguredProfileName(): StorefrontProfileName {
  const configuredProfile = process.env.NEXT_PUBLIC_STOREFRONT_PROFILE?.trim();

  if (configuredProfile === 'dev' || configuredProfile === 'test') {
    return configuredProfile;
  }

  return DEFAULT_STOREFRONT_PROFILE;
}

function readConfiguredPaymentMode(fallback: StorefrontPaymentMode): StorefrontPaymentMode {
  const configuredPaymentMode = process.env.NEXT_PUBLIC_STOREFRONT_PAYMENT_MODE?.trim();

  if (configuredPaymentMode === 'wechat-placeholder') {
    return 'wechat-placeholder';
  }

  return fallback;
}

function getProfileDefaults(profileName: StorefrontProfileName): StorefrontRuntimeProfile {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3000';

  if (profileName === 'dev') {
    return {
      name: 'dev',
      apiBaseUrl,
      customerIdentity: {
        role: DEFAULT_STOREFRONT_CUSTOMER_ROLE,
        userId: 'dev-customer'
      },
      paymentMode: DEFAULT_STOREFRONT_PAYMENT_MODE
    };
  }

  if (profileName === 'test') {
    return {
      name: 'test',
      apiBaseUrl,
      customerIdentity: {
        role: DEFAULT_STOREFRONT_CUSTOMER_ROLE,
        userId: 'test-customer'
      },
      paymentMode: DEFAULT_STOREFRONT_PAYMENT_MODE
    };
  }

  return {
    name: 'demo',
    apiBaseUrl,
    customerIdentity: {
      role: DEFAULT_STOREFRONT_CUSTOMER_ROLE,
      userId: 'demo-customer'
    },
    paymentMode: DEFAULT_STOREFRONT_PAYMENT_MODE
  };
}

const profileDefaults = getProfileDefaults(readConfiguredProfileName());

export const CURRENT_STOREFRONT_PROFILE: StorefrontRuntimeProfile = {
  ...profileDefaults,
  customerIdentity: {
    role: profileDefaults.customerIdentity.role,
    userId: readConfiguredValue(
      process.env.NEXT_PUBLIC_STOREFRONT_CUSTOMER_USER_ID,
      profileDefaults.customerIdentity.userId
    )
  },
  paymentMode: readConfiguredPaymentMode(profileDefaults.paymentMode)
};
