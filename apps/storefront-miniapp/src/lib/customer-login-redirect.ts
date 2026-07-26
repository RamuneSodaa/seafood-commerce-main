import Taro from '@tarojs/taro';

const CUSTOMER_LOGIN_PAGE_URL = '/pages/customer-login/index';
const CUSTOMER_LOGIN_REDIRECT_STORAGE_KEY = 'customerLoginRedirectUrl';

type MiniappPageSnapshot = {
  route?: string;
  options?: Record<string, string | number | boolean | undefined>;
};

export function buildCustomerLoginRedirectUrl(targetUrl: string): string {
  return `${CUSTOMER_LOGIN_PAGE_URL}?redirect=${encodeURIComponent(targetUrl)}`;
}

export function getPendingCustomerLoginRedirectUrl(): string {
  return Taro.getStorageSync<string>(CUSTOMER_LOGIN_REDIRECT_STORAGE_KEY) || '';
}

export function clearPendingCustomerLoginRedirectUrl() {
  Taro.removeStorageSync(CUSTOMER_LOGIN_REDIRECT_STORAGE_KEY);
}

export function getCurrentMiniappPageUrl(): string {
  const pages = Taro.getCurrentPages() as MiniappPageSnapshot[];
  const currentPage = pages[pages.length - 1];
  const route = currentPage?.route?.trim();

  if (!route) {
    return '/pages/products/index';
  }

  const path = route.startsWith('/') ? route : `/${route}`;
  const query = Object.entries(currentPage.options || {})
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => (
      `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`
    ))
    .join('&');

  return query ? `${path}?${query}` : path;
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

export function redirectCurrentPageToCustomerLogin(): boolean {
  const targetUrl = getCurrentMiniappPageUrl();
  const targetPath = targetUrl.split('?')[0];

  if (targetPath === CUSTOMER_LOGIN_PAGE_URL) {
    return false;
  }

  redirectToCustomerLogin(targetUrl);
  return true;
}
