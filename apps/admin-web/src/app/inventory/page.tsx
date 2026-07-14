'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AdminAlert, AdminBadge, AdminEmpty, AdminLoadingBlocks, AdminPage, AdminSection } from '../../components/admin-ui';
import { adminApi, type AdjustInventoryPayload, type InventoryRow } from '../../lib/api';
import { formatMoney } from '../../lib/orders';
import { getInventoryRelationshipHint, getInventoryRiskMeta, getInventorySummary } from '../../lib/inventory';

export default function AdminInventoryPage() {
  const [data, setData] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [adjustForm, setAdjustForm] = useState({
    deltaPhysical: '0',
    deltaAvailable: '0',
    reason: ''
  });

  async function load() {
    setLoading(true);
    setError('');

    try {
      const rows = await adminApi.inventory();
      setData(rows);
      setSelectedId((current) => current || rows[0]?.id || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载库存失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const selectedInventory = useMemo(
    () => data.find((row) => row.id === selectedId) ?? data[0] ?? null,
    [data, selectedId]
  );

  const summary = useMemo(() => getInventorySummary(data), [data]);

  async function submitAdjust(e: FormEvent) {
    e.preventDefault();
    if (!selectedInventory) return;

    const payload: AdjustInventoryPayload = {
      storeId: selectedInventory.storeId,
      skuId: selectedInventory.skuId,
      deltaPhysical: Number(adjustForm.deltaPhysical) || 0,
      deltaAvailable: Number(adjustForm.deltaAvailable) || 0,
      reason: adjustForm.reason.trim()
    };

    if (!payload.reason) {
      setError('请填写本次库存调整原因。');
      return;
    }

    const productName = selectedInventory.sku?.product?.name || '当前商品';
    const skuName = selectedInventory.sku?.name || '规格信息暂未同步';
    const storeName = selectedInventory.store?.name || '门店信息暂未同步';
    const confirmed = window.confirm(
      `确认调整“${productName} / ${skuName}”在“${storeName}”的库存吗？\n实物库存增减：${payload.deltaPhysical}\n可售库存增减：${payload.deltaAvailable}`
    );

    if (!confirmed) return;

    try {
      setSubmitting(true);
      setFeedback('');
      setError('');
      await adminApi.adjustInventory(payload);
      setFeedback('库存调整已生效，列表已刷新。');
      setAdjustForm({ deltaPhysical: '0', deltaAvailable: '0', reason: '' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '库存调整失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminPage
      eyebrow="库存作业台"
      title="查看库存状态与风险"
      description="围绕后台扫读效率组织页面：实物、可售、预留库存与门店、SKU、风险提示和人工调整区一起展示。"
      breadcrumbs={[
        { label: '控制台首页', href: '/' },
        { label: '库存' }
      ]}
      actions={
        <div className="admin-hero-actions">
          <Link className="admin-button-secondary" href="/">
            返回控制台
          </Link>
          <button className="admin-button-ghost" type="button" onClick={load}>
            刷新库存
          </button>
        </div>
      }
    >
      {error ? <AdminAlert title="加载库存失败" message={error} /> : null}
      {feedback ? <AdminAlert title="库存更新" message={feedback} tone="success" /> : null}

      <div className="admin-metric-grid">
        <section className="admin-metric-card">
          <span className="admin-kpi-label">库存记录数</span>
          <strong className="admin-kpi-value">{summary.totalRows}</strong>
          <p className="admin-helper">当前后台库存数据中，门店与 SKU 组合形成的库存记录总数。</p>
        </section>
        <section className="admin-metric-card">
          <span className="admin-kpi-label">实物库存</span>
          <strong className="admin-kpi-value">{summary.totalPhysical}</strong>
          <p className="admin-helper">实物库存表示门店当前实际在库数量。</p>
        </section>
        <section className="admin-metric-card">
          <span className="admin-kpi-label">可售 / 预留</span>
          <strong className="admin-kpi-value">{summary.totalAvailable} / {summary.totalReserved}</strong>
          <p className="admin-helper">可售库存可用于新订单，预留库存已被现有订单占用。</p>
        </section>
        <section className="admin-metric-card admin-metric-card-warning">
          <span className="admin-kpi-label">风险记录</span>
          <strong className="admin-kpi-value">{summary.lowStockCount + summary.highReservedCount}</strong>
          <p className="admin-helper">统计低库存记录，以及预留库存已明显挤压可售空间的记录。</p>
        </section>
      </div>

      <div className="admin-grid">
        <div className="admin-main">
          <AdminSection
            title="库存列表"
            description="每张卡片都聚焦关键库存关系：实物库存、可售库存、预留库存、安全库存，以及门店与 SKU 上下文。"
          >
            {loading ? (
              <AdminLoadingBlocks count={4} />
            ) : data.length === 0 ? (
              <AdminEmpty
                title="暂无库存记录"
                message="当门店、SKU 和库存数据创建完成后，库存记录会显示在这里。"
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
                {data.map((row) => {
                  const risk = getInventoryRiskMeta(row);
                  const isSelected = selectedInventory?.id === row.id;

                  return (
                    <article
                      key={row.id}
                      className={`admin-order-card admin-inventory-card ${isSelected ? 'admin-inventory-card-selected' : ''}`}
                    >
                      <div className="admin-order-header">
                        <div className="admin-title-stack">
                          <h2 className="admin-section-title">{row.sku?.name || '规格信息暂未同步'}</h2>
                          <p className="admin-helper">
                            门店：{row.store?.name || '门店信息暂未同步'} · 规格编码：{row.sku?.code || '暂未同步'}
                          </p>
                        </div>
                        <div className="admin-badges">
                          <AdminBadge tone={risk.tone}>{risk.label}</AdminBadge>
                          <AdminBadge tone="neutral">安全库存 {row.safeStock}</AdminBadge>
                        </div>
                      </div>

                      <div className="admin-stock-grid">
                        <div className="admin-stock-pill">
                          <span className="admin-kpi-label">实物</span>
                          <strong className="admin-stock-value">{row.physicalStock}</strong>
                        </div>
                        <div className="admin-stock-pill">
                          <span className="admin-kpi-label">可售</span>
                          <strong className="admin-stock-value">{row.availableStock}</strong>
                        </div>
                        <div className="admin-stock-pill">
                          <span className="admin-kpi-label">预留</span>
                          <strong className="admin-stock-value">{row.reservedStock}</strong>
                        </div>
                        <div className="admin-stock-pill">
                          <span className="admin-kpi-label">残损</span>
                          <strong className="admin-stock-value">{row.damagedStock}</strong>
                        </div>
                      </div>

                      <div className="admin-order-row">
                        <div className="admin-title-stack">
                          <p className="admin-helper">{risk.description}</p>
                          <p className="admin-helper">{getInventoryRelationshipHint(row)}</p>
                        </div>
                        <div className="admin-kpi">
                          <span className="admin-kpi-label">规格价格</span>
                          <span className="admin-kpi-value">{row.sku ? formatMoney(row.sku.priceCents) : '暂无'}</span>
                        </div>
                      </div>

                      <div className="admin-card-actions">
                        <button
                          className="admin-button"
                          type="button"
                          onClick={() => setSelectedId(row.id)}
                        >
                          {isSelected ? '已选中当前记录' : '选择此记录'}
                        </button>
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
            title="当前选中库存详情"
            description="先核对商品、规格和门店，再进行库存调整。"
          >
            {!selectedInventory ? (
              <AdminEmpty
                title="暂无选中库存"
                message="请先从左侧库存列表中选择一条记录。"
              />
            ) : (
              <div className="admin-summary-stack">
                <div className="admin-info-panel">
                  <span className="admin-info-title">商品与规格</span>
                  <p className="admin-strong-line">{selectedInventory.sku?.product?.name || '商品名称暂未同步'}</p>
                  <p className="admin-helper">规格：{selectedInventory.sku?.name || '规格信息暂未同步'}</p>
                  <p className="admin-helper">规格编码：{selectedInventory.sku?.code || '暂未同步'}</p>
                </div>
                <div className="admin-info-panel">
                  <span className="admin-info-title">门店</span>
                  <p className="admin-strong-line">{selectedInventory.store?.name || '门店信息暂未同步'}</p>
                  <p className="admin-helper">{selectedInventory.store?.address || '暂未填写门店地址'}</p>
                </div>
                <dl className="admin-summary-list">
                  <div className="admin-summary-row">
                    <dt>实物库存</dt>
                    <dd>{selectedInventory.physicalStock}</dd>
                  </div>
                  <div className="admin-summary-row">
                    <dt>可售库存</dt>
                    <dd>{selectedInventory.availableStock}</dd>
                  </div>
                  <div className="admin-summary-row">
                    <dt>预留库存</dt>
                    <dd>{selectedInventory.reservedStock}</dd>
                  </div>
                  <div className="admin-summary-row">
                    <dt>安全库存</dt>
                    <dd>{selectedInventory.safeStock}</dd>
                  </div>
                  <div className="admin-summary-row">
                    <dt>规格价格</dt>
                    <dd>{selectedInventory.sku ? formatMoney(selectedInventory.sku.priceCents) : '暂无'}</dd>
                  </div>
                </dl>
                <div className="admin-info-panel">
                  <span className="admin-info-title">库存含义</span>
                  <p className="admin-helper">实物库存是门店实际在库数量；可售库存可继续卖给新订单；预留库存已经被订单占用。</p>
                </div>
              </div>
            )}
          </AdminSection>

          <AdminSection
            title="人工调整"
            description="请谨慎使用。人工调整会直接修改实物与可售库存，建议配合清晰备注。"
          >
            {!selectedInventory ? (
              <AdminEmpty
                title="请选择一条库存记录"
                message="先从库存列表中选择一条记录，再查看当前数值并执行人工调整。"
              />
            ) : (
              <form className="admin-summary-stack" onSubmit={submitAdjust}>
                <div className="admin-info-panel">
                  <span className="admin-info-title">当前选中记录</span>
                  <p className="admin-helper">{selectedInventory.sku?.name || '规格信息暂未同步'}</p>
                  <p className="admin-helper">{selectedInventory.store?.name || '门店信息暂未同步'}</p>
                  <p className="admin-helper">
                    当前：实物 {selectedInventory.physicalStock}，可售 {selectedInventory.availableStock}，预留 {selectedInventory.reservedStock}
                  </p>
                </div>

                <label className="admin-form-field">
                  <span className="admin-info-title">实物库存增减</span>
                  <input
                    className="admin-input"
                    type="number"
                    value={adjustForm.deltaPhysical}
                    onChange={(e) => setAdjustForm((current) => ({ ...current, deltaPhysical: e.target.value }))}
                    disabled={submitting}
                  />
                </label>

                <label className="admin-form-field">
                  <span className="admin-info-title">可售库存增减</span>
                  <input
                    className="admin-input"
                    type="number"
                    value={adjustForm.deltaAvailable}
                    onChange={(e) => setAdjustForm((current) => ({ ...current, deltaAvailable: e.target.value }))}
                    disabled={submitting}
                  />
                </label>

                <label className="admin-form-field">
                  <span className="admin-info-title">调整原因</span>
                  <textarea
                    className="admin-textarea"
                    value={adjustForm.reason}
                    onChange={(e) => setAdjustForm((current) => ({ ...current, reason: e.target.value }))}
                    placeholder="说明本次人工调整的原因"
                    disabled={submitting}
                    required
                  />
                </label>

                <div className="admin-info-panel admin-info-panel-caution">
                  <span className="admin-info-title">注意事项</span>
                  <p className="admin-helper">
                    如果负向调整会导致实物或可售库存小于 0，操作将失败。该页面不会直接修改预留库存。
                  </p>
                </div>

                <div className="admin-info-panel">
                  <span className="admin-info-title">操作日志</span>
                  <p className="admin-helper">本次调整会记录操作人和原因；最近操作日志展示将在下一阶段补齐。</p>
                </div>

                <div className="admin-actions-row">
                  <button className="admin-button" type="submit" disabled={submitting}>
                    {submitting ? '正在应用调整...' : '应用调整'}
                  </button>
                  <button
                    className="admin-button-secondary"
                    type="button"
                    disabled={submitting}
                    onClick={() => setAdjustForm({ deltaPhysical: '0', deltaAvailable: '0', reason: '' })}
                  >
                    重置表单
                  </button>
                </div>
              </form>
            )}
          </AdminSection>
        </aside>
      </div>
    </AdminPage>
  );
}
