import { defineConfig } from '@tarojs/cli';

export default defineConfig({
  projectName: 'seafood-storefront-miniapp',
  date: '2026-04-08',
  sourceRoot: 'src',
  outputRoot: 'dist',
  framework: 'react',
  compiler: 'webpack5',
  plugins: ['@tarojs/plugin-framework-react', '@tarojs/plugin-platform-weapp'],
  mini: {},
  env: {
    NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'development'),
    TARO_APP_PROFILE: JSON.stringify(process.env.TARO_APP_PROFILE || ''),
    TARO_APP_API_BASE_URL: JSON.stringify(process.env.TARO_APP_API_BASE_URL || ''),
    TARO_APP_CUSTOMER_ROLE: JSON.stringify(process.env.TARO_APP_CUSTOMER_ROLE || ''),
    TARO_APP_CUSTOMER_USER_ID: JSON.stringify(process.env.TARO_APP_CUSTOMER_USER_ID || ''),
    TARO_APP_PAYMENT_MODE: JSON.stringify(process.env.TARO_APP_PAYMENT_MODE || '')
  }
});
