'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AdminAlert, AdminBadge, AdminEmpty, AdminLoadingBlocks, AdminPage, AdminSection } from '../../components/admin-ui';
import { adminApi, type StoreRow } from '../../lib/api';
import { formatDateTime } from '../../lib/orders';
import { getStoreContactSummary, getStoreStatusMeta } from '../../lib/stores';

export default function AdminStoresPage() {
  const [data, setData] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState('');

  async function load() {
    setLoading(true);
    setError('');

    try {
      const rows = await adminApi.stores();
      setData(rows);
      setSelectedId((current) => current || rows[0]?.id || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载门店失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const selectedStore = useMemo(
    () => data.find((item) => item.id === selectedId) ?? data[0] ?? null,
    [data, selectedId]
  );

  return (
    <AdminPage
      eyebrow="门店管理"
      title="查看门店状态与关联流程"
      description="围绕后台扫读效率展示门店状态、联系方式、地址信息，以及自然关联到库存和订单的入口。"
      breadcrumbs={[
        { label: '控制台首页', href: '/' },
        { label: '门店' }
      ]}
      actions={
        <div className="admin-hero-actions">
          <Link className="admin-button-secondary" href="/">
            返回控制台
          </Link>
          <button className="admin-button-ghost" type="button" onClick={load}>
            刷新门店
          </button>
        </div>
      }
    >
      {error ? <AdminAlert title="加载门店失败" message={error} /> : null}

      <div className="admin-metric-grid">
        <section className="admin-metric-card">
          <span className="admin-kpi-label">门店数量</span>
          <strong className="admin-kpi-value">{data.length}</strong>
          <p className="admin-helper">当前后台可见的门店记录总数。</p>
        </section>
        <section className="admin-metric-card">
          <span className="admin-kpi-label">营业中门店</span>
          <strong className="admin-kpi-value">{data.filter((store) => store.isActive).length}</strong>
          <p className="admin-helper">营业中门店可继续参与当前库存与订单履约流程。</p>
        </section>
        <section className="admin-metric-card">
          <span className="admin-kpi-label">未启用门店</span>
          <strong className="admin-kpi-value">{data.filter((store) => !store.isActive).length}</strong>
          <p className="admin-helper">未启用门店在继续承担库存或履约前应先复核状态。</p>
        </section>
        <section className="admin-metric-card">
          <span className="admin-kpi-label">有联系方式的门店</span>
          <strong className="admin-kpi-value">{data.filter((store) => store.contactName || store.contactPhone).length}</strong>
          <p className="admin-helper">联系方式有助于门店与库存、订单跟进之间的协同。</p>
        </section>
      </div>

      <div className="admin-grid">
        <div className="admin-main">
          <AdminSection
            title="门店列表"
            description="每张门店卡片都展示状态、地址、联系方式与关联入口，方便快速扫读后再进入其他模块。"
          >
            {loading ? (
              <AdminLoadingBlocks count={4} />
            ) : data.length === 0 ? (
              <AdminEmpty
                title="暂无门店"
                message="通过当前后台门店接口创建门店后，会显示在这里。"
                action={
                  <div className="admin-actions-row">
                    <Link className="admin-button" href="/">
                      返回控制台
                    </Link>
                  </div>
                }
              />
            ) : (
              <div className="admin-list">
                {data.map((store) => {
                  const statusMeta = getStoreStatusMeta(store);
                  const isSelected = selectedStore?.id === store.id;

                  return (
                    <article
                      key={store.id}
                      className={`admin-order-card admin-store-card ${isSelected ? 'admin-inventory-card-selected' : ''}`}
                    >
                      <div className="admin-order-header">
                        <div className="admin-title-stack">
                          <h2 className="admin-section-title">{store.name}</h2>
                          <p className="admin-helper">门店编码：{store.code}</p>
                        </div>
                        <div className="admin-badges">
                          <AdminBadge tone={statusMeta.tone}>{statusMeta.label}</AdminBadge>
                        </div>
                      </div>

                      <div className="admin-title-stack">
                        <p className="admin-helper">{statusMeta.description}</p>
                        <p className="admin-helper">地址：{store.address}</p>
                        <p className="admin-helper">联系方式：{getStoreContactSummary(store)}</p>
                      </div>

                      <div className="admin-card-actions">
                        <button className="admin-button" type="button" onClick={() => setSelectedId(store.id)}>
                          {isSelected ? '已选中当前门店' : '查看门店'}
                        </button>
                        <Link className="admin-button-secondary" href="/inventory">
                          打开库存页
                        </Link>
                        <Link className="admin-button-secondary" href="/workbench/orders">
                          打开订单页
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </AdminSection>
        </div>

        <aside className="admin-sidebar">
          <AdminSection
            title="门店详情侧栏"
            description="侧栏聚焦门店状态、联系方式，以及与门店最自然关联的运营入口。"
          >
            {!selectedStore ? (
              <AdminEmpty
                title="请选择门店"
                message="先从门店列表中选择一个门店，再查看其状态、联系方式和相关运营入口。"
              />
            ) : (
              <div className="admin-summary-stack">
                <div className="admin-info-panel">
                  <span className="admin-info-title">当前选中门店</span>
                  <p className="admin-helper">{selectedStore.name}</p>
                  <p className="admin-helper">门店编码：{selectedStore.code}</p>
                  <p className="admin-helper">创建时间：{formatDateTime(selectedStore.createdAt)}</p>
                  <p className="admin-helper">更新时间：{formatDateTime(selectedStore.updatedAt)}</p>
                  <div className="admin-badges">
                    <AdminBadge tone={getStoreStatusMeta(selectedStore).tone}>{getStoreStatusMeta(selectedStore).label}</AdminBadge>
                  </div>
                </div>

                <div className="admin-info-panel">
                  <span className="admin-info-title">基础信息</span>
                  <p className="admin-helper">地址：{selectedStore.address}</p>
                  <p className="admin-helper">联系人：{selectedStore.contactName || '未填写'}</p>
                  <p className="admin-helper">联系电话：{selectedStore.contactPhone || '未填写'}</p>
                </div>

                <div className="admin-info-panel">
                  <span className="admin-info-title">业务关联</span>
                  <p className="admin-helper">
                    门店会自然关联库存可用性与订单履约。可通过下面入口继续进入最常见的后续工作流。
                  </p>
                </div>

                <div className="admin-actions-row">
                  <Link className="admin-button" href="/inventory">
                    查看库存
                  </Link>
                  <Link className="admin-button-secondary" href="/workbench/orders">
                    查看订单作业台
                  </Link>
                </div>
              </div>
            )}
          </AdminSection>
        </aside>
      </div>
    </AdminPage>
  );
}
