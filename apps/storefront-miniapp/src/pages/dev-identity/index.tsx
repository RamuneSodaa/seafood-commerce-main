import { useEffect, useState } from 'react';
import Taro from '@tarojs/taro';
import { Button, Input, Text, View } from '@tarojs/components';

import { CURRENT_MINIAPP_PROFILE } from '../../lib/config';
import {
  isMiniappIdentityStorageOverridden,
  resolveMiniappIdentity,
  type MiniappIdentity,
  type MiniappIdentitySource
} from '../../lib/identity';
import {
  clearAllStoredCustomerIdentities,
  clearStoredPlaceholderCustomerIdentity,
  clearStoredRealCustomerIdentity,
  getStoredPlaceholderCustomerIdentity,
  getStoredRealCustomerIdentity,
  setStoredPlaceholderCustomerIdentity,
  type StoredPlaceholderCustomerIdentity,
  type StoredRealCustomerIdentity
} from '../../lib/identity-storage';
import { handleMiniappLoginSuccess } from '../../lib/login-success-orchestrator';

type IdentitySnapshot = {
  providerIdentity: MiniappIdentity;
  providerSource: MiniappIdentitySource;
  storedRealIdentity: StoredRealCustomerIdentity | null;
  storedPlaceholderIdentity: StoredPlaceholderCustomerIdentity | null;
  storageOverridden: boolean;
};

function formatSourceLabel(source: MiniappIdentitySource): string {
  if (source === 'profile-env') {
    return 'profile / env override';
  }

  if (source === 'real-storage') {
    return 'real identity storage';
  }

  if (source === 'placeholder-storage') {
    return 'placeholder identity storage';
  }

  return 'demo fallback';
}

function readIdentitySnapshot(): IdentitySnapshot {
  const resolvedIdentity = resolveMiniappIdentity();

  return {
    providerIdentity: resolvedIdentity.identity,
    providerSource: resolvedIdentity.source,
    storedRealIdentity: getStoredRealCustomerIdentity(),
    storedPlaceholderIdentity: getStoredPlaceholderCustomerIdentity(),
    storageOverridden: isMiniappIdentityStorageOverridden()
  };
}

function cardStyle(background = '#ffffff') {
  return {
    background,
    borderRadius: '24rpx',
    padding: '28rpx',
    boxShadow: '0 8rpx 24rpx rgba(15, 23, 42, 0.06)'
  } as const;
}

export default function DevIdentityPage() {
  const [realInputUserId, setRealInputUserId] = useState('');
  const [placeholderInputUserId, setPlaceholderInputUserId] = useState('');
  const [snapshot, setSnapshot] = useState<IdentitySnapshot>(() => readIdentitySnapshot());
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const nextSnapshot = readIdentitySnapshot();
    setSnapshot(nextSnapshot);
    setRealInputUserId(nextSnapshot.storedRealIdentity?.userId || '');
    setPlaceholderInputUserId(nextSnapshot.storedPlaceholderIdentity?.userId || '');
  }, []);

  function refreshSnapshot(nextFeedback?: string) {
    const nextSnapshot = readIdentitySnapshot();
    setSnapshot(nextSnapshot);
    setRealInputUserId(nextSnapshot.storedRealIdentity?.userId || '');
    setPlaceholderInputUserId(nextSnapshot.storedPlaceholderIdentity?.userId || '');
    setError('');
    setFeedback(nextFeedback || '');
  }

  function handleWriteRealIdentity() {
    const trimmedUserId = realInputUserId.trim();

    if (!trimmedUserId) {
      setError('请先输入一个 real identity customer userId。');
      setFeedback('');
      return;
    }

    const result = handleMiniappLoginSuccess({
      provider: 'mock',
      userId: trimmedUserId,
      role: 'CUSTOMER',
      raw: {
        debugSource: 'dev-identity-page'
      }
    });

    refreshSnapshot(`mock auth result 已通过 login success pipeline 写入，本次 provider 为 ${result.provider}，source 为 ${formatSourceLabel(result.resolvedIdentity.source)}。`);
  }

  function handleClearRealIdentity() {
    clearStoredRealCustomerIdentity();
    refreshSnapshot('real identity 已从本地存储清空。');
  }

  function handleWritePlaceholderIdentity() {
    const trimmedUserId = placeholderInputUserId.trim();

    if (!trimmedUserId) {
      setError('请先输入一个 placeholder customer userId。');
      setFeedback('');
      return;
    }

    setStoredPlaceholderCustomerIdentity({
      role: 'CUSTOMER',
      userId: trimmedUserId
    });

    refreshSnapshot('placeholder identity 已写入本地存储。');
  }

  function handleClearPlaceholderIdentity() {
    clearStoredPlaceholderCustomerIdentity();
    refreshSnapshot('placeholder identity 已从本地存储清空。');
  }

  function handleClearAllIdentities() {
    clearAllStoredCustomerIdentities();
    refreshSnapshot('real / placeholder identity 已全部清空。');
  }

  return (
    <View style={{ minHeight: '100vh', padding: '24rpx', display: 'flex', flexDirection: 'column', gap: '24rpx' }}>
      <View style={cardStyle()}>
        <Text style={{ display: 'block', fontSize: '24rpx', color: '#2563eb', marginBottom: '12rpx' }}>开发调试</Text>
        <Text style={{ display: 'block', fontSize: '40rpx', fontWeight: '700', marginBottom: '12rpx' }}>身份调试入口</Text>
        <Text style={{ display: 'block', fontSize: '26rpx', color: '#475569' }}>
          这个页面只用于开发时写入或清空 real / placeholder 顾客身份，不代表真实登录流程。
        </Text>
      </View>

      {error ? (
        <View style={cardStyle('#fff7ed')}>
          <Text style={{ display: 'block', fontSize: '28rpx', fontWeight: '600', marginBottom: '8rpx' }}>身份写入失败</Text>
          <Text style={{ display: 'block', fontSize: '26rpx', color: '#7c2d12' }}>{error}</Text>
        </View>
      ) : null}

      {feedback ? (
        <View style={cardStyle('#eff6ff')}>
          <Text style={{ display: 'block', fontSize: '28rpx', fontWeight: '600', marginBottom: '8rpx', color: '#1d4ed8' }}>身份调试更新</Text>
          <Text style={{ display: 'block', fontSize: '26rpx', color: '#1d4ed8' }}>{feedback}</Text>
        </View>
      ) : null}

      <View style={cardStyle()}>
        <Text style={{ display: 'block', fontSize: '32rpx', fontWeight: '700', marginBottom: '18rpx' }}>当前解析结果</Text>
        <View style={{ display: 'flex', flexDirection: 'column', gap: '12rpx' }}>
          <Text style={{ fontSize: '26rpx', color: '#475569' }}>当前 profile：{CURRENT_MINIAPP_PROFILE.name}</Text>
          <Text style={{ fontSize: '26rpx', color: '#475569' }}>
            provider 解析结果：{`${snapshot.providerIdentity.role} / ${snapshot.providerIdentity.userId}`}
          </Text>
          <Text style={{ fontSize: '26rpx', color: '#475569' }}>
            provider source：{formatSourceLabel(snapshot.providerSource)}
          </Text>
          <Text style={{ fontSize: '26rpx', color: '#475569' }}>
            real storage 值：{snapshot.storedRealIdentity ? `${snapshot.storedRealIdentity.role} / ${snapshot.storedRealIdentity.userId}` : '当前为空'}
          </Text>
          <Text style={{ fontSize: '26rpx', color: '#475569' }}>
            placeholder storage 值：
            {snapshot.storedPlaceholderIdentity ? ` ${snapshot.storedPlaceholderIdentity.role} / ${snapshot.storedPlaceholderIdentity.userId}` : ' 当前为空'}
          </Text>
          <Text style={{ fontSize: '26rpx', color: '#475569' }}>
            storage 当前是否生效：{snapshot.storageOverridden ? '否，当前被显式 profile/env 覆盖' : '是，当前由 real / placeholder storage 参与解析'}
          </Text>
        </View>
      </View>

      <View style={cardStyle()}>
        <Text style={{ display: 'block', fontSize: '32rpx', fontWeight: '700', marginBottom: '18rpx' }}>写入 real identity 落点</Text>
        <View style={{ display: 'flex', flexDirection: 'column', gap: '16rpx' }}>
          <View
            style={{
              display: 'grid',
              gap: '8rpx',
              padding: '16rpx',
              border: '2rpx solid #e2e8f0',
              borderRadius: '18rpx',
              background: '#f8fafc'
            }}
          >
            <Text style={{ fontSize: '24rpx', fontWeight: '700', color: '#0f172a' }}>real customer userId</Text>
            <Input
              type='text'
              value={realInputUserId}
              placeholder='例如：wechat-customer-1'
              onInput={(event) => setRealInputUserId(event.detail.value)}
            />
          </View>

          <View
            style={{
              display: 'grid',
              gap: '8rpx',
              padding: '16rpx',
              border: '2rpx solid #e2e8f0',
              borderRadius: '18rpx',
              background: '#f8fafc'
            }}
          >
            <Text style={{ fontSize: '24rpx', fontWeight: '700', color: '#0f172a' }}>使用说明</Text>
            <Text style={{ fontSize: '24rpx', color: '#475569' }}>
              provider 优先级固定为 `profile/env override -> real identity -> placeholder identity -> demo fallback`。
            </Text>
            <Text style={{ fontSize: '24rpx', color: '#475569' }}>
              如果当前 profile 是 `dev / test`，或显式配置了 `TARO_APP_CUSTOMER_ROLE / TARO_APP_CUSTOMER_USER_ID`，storage 值不会覆盖它。
            </Text>
            <Text style={{ fontSize: '24rpx', color: '#475569' }}>
              当前开发按钮走的是 `mock auth result -> login success pipeline`，内部串联 `mapper -> write adapter`。
            </Text>
            <Text style={{ fontSize: '24rpx', color: '#475569' }}>
              如需模拟更接近 future callback 的入口，请使用 `auth entry` 页面。
            </Text>
          </View>

          <View style={{ display: 'flex', gap: '16rpx', flexWrap: 'wrap' }}>
            <Button onClick={() => Taro.navigateTo({ url: '/pages/dev-auth-entry/index' })}>打开 placeholder auth entry</Button>
            <Button onClick={() => Taro.navigateTo({ url: '/pages/dev-auth-real-entry/index' })}>打开 real auth skeleton</Button>
            <Button type='primary' onClick={handleWriteRealIdentity}>
              写入 real identity
            </Button>
            <Button onClick={handleClearRealIdentity}>清空 real identity</Button>
          </View>
        </View>
      </View>

      <View style={cardStyle()}>
        <Text style={{ display: 'block', fontSize: '32rpx', fontWeight: '700', marginBottom: '18rpx' }}>写入 placeholder identity</Text>
        <View style={{ display: 'flex', flexDirection: 'column', gap: '16rpx' }}>
          <View
            style={{
              display: 'grid',
              gap: '8rpx',
              padding: '16rpx',
              border: '2rpx solid #e2e8f0',
              borderRadius: '18rpx',
              background: '#f8fafc'
            }}
          >
            <Text style={{ fontSize: '24rpx', fontWeight: '700', color: '#0f172a' }}>placeholder customer userId</Text>
            <Input
              type='text'
              value={placeholderInputUserId}
              placeholder='例如：dev-customer-2'
              onInput={(event) => setPlaceholderInputUserId(event.detail.value)}
            />
          </View>

          <View style={{ display: 'flex', gap: '16rpx', flexWrap: 'wrap' }}>
            <Button type='primary' onClick={handleWritePlaceholderIdentity}>
              写入 placeholder identity
            </Button>
            <Button onClick={handleClearPlaceholderIdentity}>清空 placeholder identity</Button>
            <Button onClick={() => refreshSnapshot('当前显示结果已刷新。')}>刷新当前状态</Button>
            <Button onClick={handleClearAllIdentities}>清空全部 identity</Button>
          </View>

          <View style={{ display: 'flex', gap: '16rpx', flexWrap: 'wrap' }}>
            <Button onClick={() => Taro.navigateTo({ url: '/pages/products/index' })}>返回商品列表</Button>
            <Button onClick={() => Taro.navigateTo({ url: '/pages/orders/index' })}>查看订单</Button>
          </View>
        </View>
      </View>
    </View>
  );
}
