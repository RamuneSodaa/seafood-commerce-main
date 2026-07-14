'use client';

import Link from 'next/link';
import { useState } from 'react';

import { AlertMessage, PageShell, SectionCard } from '../../../components/ui';
import { exchangeAuthPlaceholder } from '../../../lib/api';
import { CURRENT_STOREFRONT_PROFILE } from '../../../lib/config';
import {
  handleStorefrontLoginSuccess,
  type StorefrontLoginSuccessPipelineResult
} from '../../../lib/login-success-orchestrator';

function formatSourceLabel(source: StorefrontLoginSuccessPipelineResult['resolvedIdentity']['source']): string {
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
  const [result, setResult] = useState<StorefrontLoginSuccessPipelineResult | null>(null);
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
      const nextResult = handleStorefrontLoginSuccess(exchangedResult);

      setResult(nextResult);
      setError('');
      setFeedback(`前端 entry -> 后端 exchange placeholder -> 前端 identity pipeline 已打通，本次 provider 为 ${nextResult.provider}，source 为 ${formatSourceLabel(nextResult.resolvedIdentity.source)}。`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'auth exchange placeholder 请求失败');
      setFeedback('');
    }
  }

  return (
    <PageShell
      eyebrow="开发调试"
      title="Auth Entry Placeholder"
      description="这个页面只用于模拟 future auth success payload 的前端承接入口，不代表真实微信登录、token 或 session 回调。"
      breadcrumbs={[
        { label: '商品', href: '/' },
        { label: '开发身份入口', href: '/dev/identity' },
        { label: 'Auth Entry Placeholder' }
      ]}
      actions={
        <>
          <Link className="button-secondary" href="/dev/identity">
            返回身份调试
          </Link>
          <Link className="button-ghost" href="/">
            返回商城
          </Link>
        </>
      }
    >
      {error ? <AlertMessage title="auth entry 处理失败" message={error} /> : null}
      {feedback ? <AlertMessage title="auth entry 处理结果" message={feedback} /> : null}

      <SectionCard
        title="输入 mock / future auth success payload"
        description="当前入口只负责接收前端 payload，调用后端 exchange placeholder，再接回现有 login success orchestrator。"
      >
        <div className="form-stack">
          <label className="checkout-note">
            <span className="checkout-note-label">provider</span>
            <select className="input" value={provider} onChange={(event) => setProvider(event.target.value as 'mock' | 'wechat')}>
              <option value="mock">mock</option>
              <option value="wechat">wechat</option>
            </select>
          </label>

          <label className="checkout-note">
            <span className="checkout-note-label">userId</span>
            <input
              className="input"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder="例如：wechat-customer-1"
            />
          </label>

          <label className="checkout-note">
            <span className="checkout-note-label">displayName（可选）</span>
            <input
              className="input"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="例如：演示顾客"
            />
          </label>

          <div className="checkout-info-panel">
            <h3 className="checkout-info-title">当前入口职责</h3>
            <p className="helper-text">页面层未来应优先调用 <code>auth entry / callback -&gt; backend exchange -&gt; orchestrator</code>，而不是自己拼内部链路。</p>
            <p className="helper-text">当前 profile：<code>{CURRENT_STOREFRONT_PROFILE.name}</code></p>
          </div>

          <div className="action-row">
            <button className="button" type="button" onClick={handleSubmit}>
              提交 auth success payload
            </button>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="当前 resolved identity 反馈"
        description="这里只展示本次 auth entry 调用 orchestrator 后的最小结果。"
      >
        {result ? (
          <dl className="summary-list">
            <div className="summary-row">
              <dt>provider</dt>
              <dd>{result.provider}</dd>
            </div>
            <div className="summary-row">
              <dt>resolved identity</dt>
              <dd>{`${result.resolvedIdentity.identity.role} / ${result.resolvedIdentity.identity.userId}`}</dd>
            </div>
            <div className="summary-row">
              <dt>resolved source</dt>
              <dd>{formatSourceLabel(result.resolvedIdentity.source)}</dd>
            </div>
          </dl>
        ) : (
          <p className="helper-text">尚未提交 auth success payload。</p>
        )}
      </SectionCard>
    </PageShell>
  );
}
