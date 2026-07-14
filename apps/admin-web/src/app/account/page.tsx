'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { AdminAlert, AdminPage, AdminSection } from '../../components/admin-ui';
import { adminApi, clearAdminSession } from '../../lib/api';

// Phase 2.41B：管理员修改自己的密码。成功后清除本地会话并要求重新登录。
export default function AdminAccountPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  async function submit() {
    setError('');
    setFeedback('');
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('请填写当前密码、新密码与确认新密码。');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致。');
      return;
    }
    if (newPassword.trim().length < 12 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError('新密码至少 12 位，且需同时包含字母和数字。');
      return;
    }

    try {
      setSubmitting(true);
      await adminApi.changePassword({ currentPassword, newPassword, confirmPassword });
      setFeedback('密码已修改，请使用新密码重新登录。');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      // 修改成功后清除本地 token，要求重新登录，避免旧 token 继续使用。
      setTimeout(() => {
        clearAdminSession();
        router.replace('/login');
      }, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : '修改密码失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminPage
      eyebrow="账号安全"
      title="修改密码"
      description="修改当前登录管理员的密码。修改成功后需要使用新密码重新登录。"
      breadcrumbs={[{ label: '控制台首页', href: '/' }, { label: '账号安全' }]}
    >
      <AdminSection title="修改密码" description="新密码至少 12 位，且需同时包含字母和数字；不能与当前密码相同。">
        {error ? <AdminAlert tone="danger" title="操作失败" message={error} /> : null}
        {feedback ? <AdminAlert tone="success" title="操作成功" message={feedback} /> : null}

        <div className="admin-form-field">
          <label htmlFor="cur-pw">当前密码</label>
          <input id="cur-pw" className="admin-input" type="password" value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
        </div>
        <div className="admin-form-field">
          <label htmlFor="new-pw">新密码</label>
          <input id="new-pw" className="admin-input" type="password" value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
        </div>
        <div className="admin-form-field">
          <label htmlFor="confirm-pw">确认新密码</label>
          <input id="confirm-pw" className="admin-input" type="password" value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
        </div>
        <div className="admin-actions-row">
          <button className="admin-button" type="button" disabled={submitting} onClick={submit}>
            {submitting ? '正在修改...' : '修改密码'}
          </button>
        </div>
      </AdminSection>
    </AdminPage>
  );
}
