import Taro from '@tarojs/taro';

const CUSTOMER_LOGIN_PAGE_URL = '/pages/customer-login/index';
const CUSTOMER_LOGIN_REDIRECT_STORAGE_KEY = 'customerLoginRedirectUrl';

export function buildCustomerLoginRedirectUrl(targetUrl: string): string {
  return `${CUSTOMER_LOGIN_PAGE_URL}?redirect=${encodeURIComponent(targetUrl)}`;
}

export function getPendingCustomerLoginRedirectUrl(): string {
  return Taro.getStorageSync<string>(CUSTOMER_LOGIN_REDIRECT_STORAGE_KEY) || '';
}

export function clearPendingCustomerLoginRedirectUrl() {
  Taro.removeStorageSync(CUSTOMER_LOGIN_REDIRECT_STORAGE_KEY);
}

export function redirectToCustomerLogin(targetUrl: string) {
  Taro.setStorageSync(CUSTOMER_LOGIN_REDIRECT_STORAGE_KEY, targetUrl);

  Taro.showToast({
    title: '请先登录',
    icon: 'none'
  });

  Taro.switchTab({
    url: CUSTOMER_LOGIN_PAGE_URL
  });
}
