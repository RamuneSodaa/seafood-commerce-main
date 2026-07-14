'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertMessage, PageShell, SectionCard } from '../../../components/ui';
import { CURRENT_STOREFRONT_PROFILE } from '../../../lib/config';
import {
  isStorefrontIdentityStorageOverridden,
  resolveStorefrontIdentity,
  type StorefrontIdentity,
  type StorefrontIdentitySource
} from '../../../lib/identity';
import {
  clearAllStoredCustomerIdentities,
  clearStoredPlaceholderCustomerIdentity,
  clearStoredRealCustomerIdentity,
  getStoredPlaceholderCustomerIdentity,
  getStoredRealCustomerIdentity,
  setStoredPlaceholderCustomerIdentity,
  type StoredPlaceholderCustomerIdentity,
  type StoredRealCustomerIdentity
} from '../../../lib/identity-storage';
import { handleStorefrontLoginSuccess } from '../../../lib/login-success-orchestrator';

type IdentitySnapshot = {
  providerIdentity: StorefrontIdentity;
  providerSource: StorefrontIdentitySource;
  storedRealIdentity: StoredRealCustomerIdentity | null;
  storedPlaceholderIdentity: StoredPlaceholderCustomerIdentity | null;
  storageOverridden: boolean;
};

function formatSourceLabel(source: StorefrontIdentitySource): string {
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
  const resolvedIdentity = resolveStorefrontIdentity();

  return {
    providerIdentity: resolvedIdentity.identity,
    providerSource: resolvedIdentity.source,
    storedRealIdentity: getStoredRealCustomerIdentity(),
    storedPlaceholderIdentity: getStoredPlaceholderCustomerIdentity(),
    storageOverridden: isStorefrontIdentityStorageOverridden()
  };
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

    const result = handleStorefrontLoginSuccess({
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
    <PageShell
      eyebrow="开发调试"
      title="身份调试入口"
      description="这个页面只用于开发时写入或清空 real / placeholder 顾客身份，不代表真实登录流程。"
      breadcrumbs={[
        { label: '商品', href: '/' },
        { label: '开发身份入口' }
      ]}
      actions={
        <>
          <Link className="button" href="/dev/auth-entry">
            打开 auth entry
          </Link>
          <Link className="button-secondary" href="/">
            返回商城
          </Link>
          <Link className="button-ghost" href="/orders">
            查看订单
          </Link>
        </>
      }
    >
      {error ? <AlertMessage title="身份写入失败" message={error} /> : null}
      {feedback ? <AlertMessage title="身份调试更新" message={feedback} /> : null}

      <SectionCard
        title="当前解析结果"
        description="这里显示 identity provider 当前真正解析出来的顾客身份、来源 source，以及 real / placeholder 两层本地存储值。"
      >
        <dl className="summary-list">
          <div className="summary-row">
            <dt>当前 profile</dt>
            <dd>{CURRENT_STOREFRONT_PROFILE.name}</dd>
          </div>
          <div className="summary-row">
            <dt>provider 解析结果</dt>
            <dd>{`${snapshot.providerIdentity.role} / ${snapshot.providerIdentity.userId}`}</dd>
          </div>
          <div className="summary-row">
            <dt>provider source</dt>
            <dd>{formatSourceLabel(snapshot.providerSource)}</dd>
          </div>
          <div className="summary-row">
            <dt>real storage 值</dt>
            <dd>{snapshot.storedRealIdentity ? `${snapshot.storedRealIdentity.role} / ${snapshot.storedRealIdentity.userId}` : '当前为空'}</dd>
          </div>
          <div className="summary-row">
            <dt>placeholder storage 值</dt>
            <dd>{snapshot.storedPlaceholderIdentity ? `${snapshot.storedPlaceholderIdentity.role} / ${snapshot.storedPlaceholderIdentity.userId}` : '当前为空'}</dd>
          </div>
          <div className="summary-row">
            <dt>storage 当前是否生效</dt>
            <dd>{snapshot.storageOverridden ? '否，当前被显式 profile/env 覆盖' : '是，当前由 real / placeholder storage 参与解析'}</dd>
          </div>
        </dl>
      </SectionCard>

      <SectionCard
        title="写入 real identity 落点"
        description="这里只是 future real identity 的本地落点模拟，不代表真实微信登录、token 或 session。"
      >
        <div className="form-stack">
          <label className="checkout-note">
            <span className="checkout-note-label">real customer userId</span>
            <input
              className="input"
              value={realInputUserId}
              onChange={(event) => setRealInputUserId(event.target.value)}
              placeholder="例如：wechat-customer-1"
            />
          </label>

          <div className="checkout-info-panel">
            <h3 className="checkout-info-title">使用说明</h3>
            <p className="helper-text">
              provider 优先级固定为 <code>profile/env override -&gt; real identity -&gt; placeholder identity -&gt; demo fallback</code>。
            </p>
            <p className="helper-text">
              如果当前 profile 是 <code>dev / test</code>，或显式配置了 <code>NEXT_PUBLIC_STOREFRONT_CUSTOMER_USER_ID</code>，storage 值不会覆盖它。
            </p>
            <p className="helper-text">
              当前开发按钮走的是 <code>mock auth result -&gt; login success pipeline</code>，内部串联 <code>mapper -&gt; write adapter</code>。
            </p>
            <p className="helper-text">
              如需模拟更接近 future callback 的入口，请使用上方的 <code>auth entry</code> 页面。
            </p>
          </div>

          <div className="action-row">
            <button className="button" type="button" onClick={handleWriteRealIdentity}>
              写入 real identity
            </button>
            <button className="button-ghost" type="button" onClick={handleClearRealIdentity}>
              清空 real identity
            </button>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="写入 placeholder identity"
        description="只有在没有显式 profile/env 覆盖，且 real identity 为空时，placeholder 才会成为请求层实际使用的身份。"
      >
        <div className="form-stack">
          <label className="checkout-note">
            <span className="checkout-note-label">placeholder customer userId</span>
            <input
              className="input"
              value={placeholderInputUserId}
              onChange={(event) => setPlaceholderInputUserId(event.target.value)}
              placeholder="例如：dev-customer-2"
            />
          </label>

          <div className="action-row">
            <button className="button" type="button" onClick={handleWritePlaceholderIdentity}>
              写入 placeholder identity
            </button>
            <button className="button-ghost" type="button" onClick={handleClearPlaceholderIdentity}>
              清空 placeholder identity
            </button>
            <button className="button-secondary" type="button" onClick={() => refreshSnapshot('当前显示结果已刷新。')}>
              刷新当前状态
            </button>
            <button className="button-secondary" type="button" onClick={handleClearAllIdentities}>
              清空全部 identity
            </button>
          </div>
        </div>
      </SectionCard>
    </PageShell>
  );
}
