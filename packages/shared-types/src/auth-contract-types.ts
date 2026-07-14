export type AuthProvider = 'mock' | 'wechat';
export type CustomerAuthRole = 'CUSTOMER';

export interface AuthSuccessResult {
  provider: AuthProvider;
  userId: string;
  role?: CustomerAuthRole;
  displayName?: string;
  raw?: unknown;
}

export interface RealAuthExchangeInputPlaceholder {
  provider: AuthProvider;
  providerCredential?: string;
  providerCode?: string;
  providerState?: string;
  callbackPayload?: unknown;
  raw?: unknown;
}
