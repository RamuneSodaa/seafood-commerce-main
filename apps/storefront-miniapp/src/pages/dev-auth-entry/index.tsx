import { useState } from 'react';
import Taro from '@tarojs/taro';
import { Button, Input, Text, View } from '@tarojs/components';

import { exchangeAuthPlaceholder } from '../../lib/api';
import { CURRENT_MINIAPP_PROFILE } from '../../lib/config';
import {
  handleMiniappLoginSuccess,
  type MiniappLoginSuccessPipelineResult
} from '../../lib/login-success-orchestrator';

function cardStyle(background = '#ffffff') {
  return {
    background,
    borderRadius: '24rpx',
    padding: '28rpx',
    boxShadow: '0 8rpx 24rpx rgba(15, 23, 42, 0.06)'
  } as const;
}

function formatSourceLabel(source: MiniappLoginSuccessPipelineResult['resolvedIdentity']['source']): string {
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

export default function DevAuthEntryPage() {
  const [provider, setProvider] = useState<'mock' | 'wechat'>('mock');
  const [userId, setUserId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [result, setResult] = useState<MiniappLoginSuccessPipelineResult | null>(null);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit() {
    const trimmedUserId = userId.trim();

    if (!trimmedUserId) {
      setError('请先输入 auth success payload 的 userId。');
      setFeedback('');
      return;
    }

    try {
      const exchangedResult = await exchangeAuthPlaceholder({
        provider,
        userId: trimmedUserId,
        displayName: displayName.trim() || undefined,
        raw: {
          debugSource: 'dev-auth-entry-page'
        }
      });
      const nextResult = handleMiniappLoginSuccess(exchangedResult);

      setResult(nextResult);
      setError('');
      setFeedback(`前端 entry -> 后端 exchange placeholder -> 前端 identity pipeline 已打通，本次 provider 为 ${nextResult.provider}，source 为 ${formatSourceLabel(nextResult.resolvedIdentity.source)}。`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'auth exchange placeholder 请求失败');
      setFeedback('');
    }
  }

  return (
    <View style={{ minHeight: '100vh', padding: '24rpx', display: 'flex', flexDirection: 'column', gap: '24rpx' }}>
      <View style={cardStyle()}>
        <Text style={{ display: 'block', fontSize: '24rpx', color: '#2563eb', marginBottom: '12rpx' }}>开发调试</Text>
        <Text style={{ display: 'block', fontSize: '40rpx', fontWeight: '700', marginBottom: '12rpx' }}>Auth Entry Placeholder</Text>
        <Text style={{ display: 'block', fontSize: '26rpx', color: '#475569' }}>
          这个页面只用于模拟 future auth success payload 的前端承接入口，不代表真实微信登录、token 或 session 回调。
        </Text>
      </View>

      {error ? (
        <View style={cardStyle('#fff7ed')}>
          <Text style={{ display: 'block', fontSize: '28rpx', fontWeight: '600', marginBottom: '8rpx' }}>auth entry 处理失败</Text>
          <Text style={{ display: 'block', fontSize: '26rpx', color: '#7c2d12' }}>{error}</Text>
        </View>
      ) : null}

      {feedback ? (
        <View style={cardStyle('#eff6ff')}>
          <Text style={{ display: 'block', fontSize: '28rpx', fontWeight: '600', marginBottom: '8rpx', color: '#1d4ed8' }}>auth entry 处理结果</Text>
          <Text style={{ display: 'block', fontSize: '26rpx', color: '#1d4ed8' }}>{feedback}</Text>
        </View>
      ) : null}

      <View style={cardStyle()}>
        <Text style={{ display: 'block', fontSize: '32rpx', fontWeight: '700', marginBottom: '18rpx' }}>输入 mock / future auth success payload</Text>
        <View style={{ display: 'flex', flexDirection: 'column', gap: '16rpx' }}>
          <View style={{ display: 'flex', gap: '16rpx', flexWrap: 'wrap' }}>
            <Button type={provider === 'mock' ? 'primary' : undefined} onClick={() => setProvider('mock')}>
              provider: mock
            </Button>
            <Button type={provider === 'wechat' ? 'primary' : undefined} onClick={() => setProvider('wechat')}>
              provider: wechat
            </Button>
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
            <Text style={{ fontSize: '24rpx', fontWeight: '700', color: '#0f172a' }}>userId</Text>
            <Input
              type='text'
              value={userId}
              placeholder='例如：wechat-customer-1'
              onInput={(event) => setUserId(event.detail.value)}
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
            <Text style={{ fontSize: '24rpx', fontWeight: '700', color: '#0f172a' }}>displayName（可选）</Text>
            <Input
              type='text'
              value={displayName}
              placeholder='例如：演示顾客'
              onInput={(event) => setDisplayName(event.detail.value)}
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
            <Text style={{ fontSize: '24rpx', fontWeight: '700', color: '#0f172a' }}>当前入口职责</Text>
            <Text style={{ fontSize: '24rpx', color: '#475569' }}>
              页面层未来应优先走 `auth entry / callback -> backend exchange -> orchestrator`，而不是自己拼内部链路。
            </Text>
            <Text style={{ fontSize: '24rpx', color: '#475569' }}>当前 profile：{CURRENT_MINIAPP_PROFILE.name}</Text>
          </View>

          <View style={{ display: 'flex', gap: '16rpx', flexWrap: 'wrap' }}>
            <Button type='primary' onClick={handleSubmit}>
              提交 auth success payload
            </Button>
          </View>
        </View>
      </View>

      <View style={cardStyle()}>
        <Text style={{ display: 'block', fontSize: '32rpx', fontWeight: '700', marginBottom: '18rpx' }}>当前 resolved identity 反馈</Text>
        {result ? (
          <View style={{ display: 'flex', flexDirection: 'column', gap: '12rpx' }}>
            <Text style={{ fontSize: '26rpx', color: '#475569' }}>provider：{result.provider}</Text>
            <Text style={{ fontSize: '26rpx', color: '#475569' }}>
              resolved identity：{`${result.resolvedIdentity.identity.role} / ${result.resolvedIdentity.identity.userId}`}
            </Text>
            <Text style={{ fontSize: '26rpx', color: '#475569' }}>
              resolved source：{formatSourceLabel(result.resolvedIdentity.source)}
            </Text>
          </View>
        ) : (
          <Text style={{ fontSize: '24rpx', color: '#475569' }}>尚未提交 auth success payload。</Text>
        )}
      </View>

      <View style={{ display: 'flex', gap: '16rpx', flexWrap: 'wrap' }}>
        <Button onClick={() => Taro.navigateTo({ url: '/pages/dev-auth-real-entry/index' })}>打开 real auth skeleton</Button>
        <Button onClick={() => Taro.navigateTo({ url: '/pages/dev-identity/index' })}>返回身份调试</Button>
        <Button onClick={() => Taro.navigateTo({ url: '/pages/products/index' })}>返回商品列表</Button>
      </View>
    </View>
  );
}
