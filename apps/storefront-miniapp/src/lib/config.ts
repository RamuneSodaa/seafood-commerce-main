export const DEFAULT_CUSTOMER_ROLE = 'CUSTOMER' as const;
export const DEFAULT_CUSTOMER_USER_ID = 'demo-customer';
export const DEFAULT_PAYMENT_MODE = 'mock' as const;
export const DEFAULT_MINIAPP_PROFILE = 'demo' as const;
export const MINIAPP_CUSTOMER_IDENTITY_STORAGE_KEY = 'seafood-miniapp-customer-identity';
export const MINIAPP_REAL_CUSTOMER_IDENTITY_STORAGE_KEY = 'seafood-miniapp-real-customer-identity';
export const MINIAPP_CUSTOMER_AUTH_ARTIFACT_STORAGE_KEY = 'seafood-miniapp-customer-auth-artifact';

export type MiniappProfileName = 'demo' | 'dev' | 'test';
export type MiniappPaymentMode = 'mock' | 'wechat-placeholder';

type MiniappCustomerIdentity = {
  role: typeof DEFAULT_CUSTOMER_ROLE;
  userId: string;
};

type MiniappRuntimeProfile = {
  name: MiniappProfileName;
  apiBaseUrl: string;
  customerIdentity: MiniappCustomerIdentity;
  paymentMode: MiniappPaymentMode;
};

function readConfiguredValue(value: string | undefined, fallback: string): string {
  const trimmedValue = value?.trim();
  return trimmedValue || fallback;
}

function readConfiguredProfileName(): MiniappProfileName {
  const configuredProfile = process.env.TARO_APP_PROFILE?.trim();

  if (configuredProfile === 'dev' || configuredProfile === 'test') {
    return configuredProfile;
  }

  return DEFAULT_MINIAPP_PROFILE;
}

function readConfiguredPaymentMode(): MiniappPaymentMode {
  const configuredPaymentMode = process.env.TARO_APP_PAYMENT_MODE?.trim();

  if (configuredPaymentMode === 'wechat-placeholder') {
    return 'wechat-placeholder';
  }

  return DEFAULT_PAYMENT_MODE;
}

function getProfileDefaults(profileName: MiniappProfileName): MiniappRuntimeProfile {
  const apiBaseUrl = process.env.TARO_APP_API_BASE_URL || 'http://192.168.1.4:3000';

  if (profileName === 'dev') {
    return {
      name: 'dev',
      apiBaseUrl,
      customerIdentity: {
        role: DEFAULT_CUSTOMER_ROLE,
        userId: 'dev-customer'
      },
      paymentMode: DEFAULT_PAYMENT_MODE
    };
  }

  if (profileName === 'test') {
    return {
      name: 'test',
      apiBaseUrl,
      customerIdentity: {
        role: DEFAULT_CUSTOMER_ROLE,
        userId: 'test-customer'
      },
      paymentMode: DEFAULT_PAYMENT_MODE
    };
  }

  return {
    name: 'demo',
    apiBaseUrl,
    customerIdentity: {
      role: DEFAULT_CUSTOMER_ROLE,
      userId: DEFAULT_CUSTOMER_USER_ID
    },
    paymentMode: DEFAULT_PAYMENT_MODE
  };
}

const profileDefaults = getProfileDefaults(readConfiguredProfileName());

export const CURRENT_MINIAPP_PROFILE: MiniappRuntimeProfile = {
  ...profileDefaults,
  customerIdentity: {
    role: readConfiguredValue(
      process.env.TARO_APP_CUSTOMER_ROLE,
      profileDefaults.customerIdentity.role
    ) as typeof DEFAULT_CUSTOMER_ROLE,
    userId: readConfiguredValue(
      process.env.TARO_APP_CUSTOMER_USER_ID,
      profileDefaults.customerIdentity.userId
    )
  },
  paymentMode: readConfiguredPaymentMode()
};
