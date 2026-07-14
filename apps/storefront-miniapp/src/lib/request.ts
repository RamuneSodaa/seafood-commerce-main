import Taro from '@tarojs/taro';

import { CURRENT_MINIAPP_PROFILE } from './config';
import { getMiniappIdentity } from './identity';

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

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const identity = getMiniappIdentity();
  const authArtifact = options.authArtifact?.trim();

  const response = await Taro.request<T | ApiError>({
    url: `${CURRENT_MINIAPP_PROFILE.apiBaseUrl}${path}`,
    method: options.method || 'GET',
    data: options.data,
    header: {
      'content-type': 'application/json',
      'x-role': identity.role,
      'x-user-id': identity.userId,
      ...(authArtifact ? { Authorization: `Bearer ${authArtifact}` } : {})
    }
  });

  if (response.statusCode < 200 || response.statusCode >= 300) {
    const data = response.data as ApiError;
    throw new Error(data?.error?.message || '请求失败');
  }

  return response.data as T;
}
