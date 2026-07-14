'use client';

import { useEffect, useMemo, useState } from 'react';

import { AdminAlert, AdminBadge, AdminEmpty, AdminLoadingBlocks, AdminPage, AdminSection } from '../../components/admin-ui';
import { adminApi, type AdminAuditLogEntry } from '../../lib/api';
import { formatDateTime } from '../../lib/orders';

type FilterKey = 'all' | 'product' | 'sku';

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    'product.update': '商品编辑',
    'product.publish': '商品发布',
    'product.unpublish': '商品下架',
    'sku.create': '新增规格',
    'sku.update': '规格变更'
  };
  return map[action] || action;
}

// Phase 2.42A：后台操作日志（仅 ADMIN 可访问对应 API）。
export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AdminAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const rows = await adminApi.auditLogs({ limit: 100 });
      setLogs(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载操作日志失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(
    () => (filter === 'all' ? logs : logs.filter((l) => l.entityType === filter)),
    [logs, filter]
  );

  return (
    <AdminPage
      eyebrow="操作日志"
      title="后台关键操作审计"
      description="记录商品与 SKU 的关键操作（编辑/新增/发布/下架/停售），便于追踪谁在何时改了什么。仅记录非敏感操作摘要。"
      breadcrumbs={[{ label: '控制台首页', href: '/' }, { label: '操作日志' }]}
    >
      <AdminSection title="最近操作" description="默认展示最近 100 条，按时间倒序。">
        {error ? <AdminAlert tone="danger" title="加载失败" message={error} /> : null}
        <div className="admin-badges" style={{ marginBottom: '16px' }}>
          {([
            { key: 'all', label: '全部' },
            { key: 'product', label: '商品' },
            { key: 'sku', label: 'SKU' }
          ] as Array<{ key: FilterKey; label: string }>).map((t) => (
            <button
              key={t.key}
              type="button"
              className={filter === t.key ? 'admin-button' : 'admin-button-secondary'}
              onClick={() => setFilter(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {loading ? (
          <AdminLoadingBlocks count={4} />
        ) : visible.length === 0 ? (
          <AdminEmpty title="暂无操作日志" message="后台执行商品/SKU 关键操作后会显示在这里。" />
        ) : (
          <div className="admin-list">
            {visible.map((log) => (
              <article key={log.id} className="admin-order-card">
                <div className="admin-order-header">
                  <div className="admin-title-stack">
                    <h2 className="admin-section-title">{log.entityLabel || log.entityId}</h2>
                    <p className="admin-helper">{log.summary || '—'}</p>
                  </div>
                  <div className="admin-badges">
                    <AdminBadge tone="accent">{actionLabel(log.action)}</AdminBadge>
                    <AdminBadge tone="neutral">{log.entityType}</AdminBadge>
                  </div>
                </div>
                <p className="admin-helper">
                  操作人：{log.admin?.displayName || log.admin?.username || (log.adminId ? log.adminId : '系统')} · {formatDateTime(log.createdAt)}
                </p>
              </article>
            ))}
          </div>
        )}
      </AdminSection>
    </AdminPage>
  );
}
