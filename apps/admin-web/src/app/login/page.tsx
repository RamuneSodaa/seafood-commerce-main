'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi, getStoredAdminToken, storeAdminSession } from '../../lib/api';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (getStoredAdminToken()) {
      router.replace('/');
    }
  }, [router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await adminApi.login({ username, password });
      storeAdminSession(response);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-card">
        <div className="admin-brand-copy">
          <span className="admin-brand-mark" aria-hidden="true">
            绿
          </span>
          <strong>绿膳荟商家后台</strong>
          <span>请使用管理员账号登录后管理订单、库存、商品与门店。</span>
        </div>

        <form className="admin-login-form" onSubmit={submit}>
          <label className="admin-form-field">
            <span className="admin-info-title">账号</span>
            <input
              className="admin-input"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="请输入管理员账号"
              autoComplete="username"
              disabled={submitting}
              required
            />
          </label>

          <label className="admin-form-field">
            <span className="admin-info-title">密码</span>
            <input
              className="admin-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="请输入管理员密码"
              autoComplete="current-password"
              disabled={submitting}
              required
            />
          </label>

          {error ? (
            <div className="admin-login-error">
              <strong>登录未通过</strong>
              <span>{error}</span>
            </div>
          ) : null}

          <button className="admin-button" type="submit" disabled={submitting}>
            {submitting ? '正在登录...' : '登录后台'}
          </button>
        </form>

        <p className="admin-helper">
          本地开发账号由环境变量创建；正式环境请使用商家负责人分配的后台账号。
        </p>
      </section>
    </main>
  );
}
