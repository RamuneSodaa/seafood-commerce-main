import Taro from '@tarojs/taro';

import { CURRENT_MINIAPP_PROFILE } from './config';
import { redirectCurrentPageToCustomerLogin } from './customer-login-redirect';
import { clearAllStoredCustomerIdentities } from './identity-storage';

type ApiError = {
  success?: false;
  error?: {
    message?: string;
  };
};

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data?: unknown;
  authArtifact?: string;
};

export class CustomerAuthenticationRequiredError extends Error {
  readonly code = 'CUSTOMER_AUTH_REQUIRED';
  readonly statusCode = 401;

  constructor(message = '登录状态已失效，请重新登录。') {
    super(message);
    this.name = 'CustomerAuthenticationRequiredError';
  }
}

export function isCustomerAuthenticationRequiredError(
  error: unknown
): error is CustomerAuthenticationRequiredError {
  return (
    error instanceof CustomerAuthenticationRequiredError ||
    (
      error instanceof Error &&
      (error as Error & { code?: string }).code === 'CUSTOMER_AUTH_REQUIRED'
    )
  );
}

let authRedirectInProgress = false;

function handleCustomerAuthenticationFailure(message?: string): never {
  clearAllStoredCustomerIdentities();

  if (!authRedirectInProgress) {
    authRedirectInProgress = true;
    redirectCurrentPageToCustomerLogin();

    setTimeout(() => {
      authRedirectInProgress = false;
    }, 1000);
  }

  throw new CustomerAuthenticationRequiredError(
    message?.trim() || '登录状态已失效，请重新登录。'
  );
}

export async function request<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const authArtifact = options.authArtifact?.trim();

  const response = await Taro.request<T | ApiError>({
    url: `${CURRENT_MINIAPP_PROFILE.apiBaseUrl}${path}`,
    method: options.method || 'GET',
    data: options.data,
    header: {
      'content-type': 'application/json',
      ...(authArtifact ? { Authorization: `Bearer ${authArtifact}` } : {})
    }
  });

  if (response.statusCode < 200 || response.statusCode >= 300) {
    const data = response.data as ApiError;
    const message = data?.error?.message || '请求失败';

    if (response.statusCode === 401) {
      handleCustomerAuthenticationFailure(message);
    }

    throw new Error(message);
  }

  return response.data as T;
}
