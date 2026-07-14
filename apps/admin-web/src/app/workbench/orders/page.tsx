'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AdminAlert, AdminBadge, AdminEmpty, AdminLoadingBlocks, AdminPage, AdminSection } from '../../../components/admin-ui';
import { storeApi, type OrderSummary } from '../../../lib/api';
import {
  FRESH_PREORDER_BADGE_LABEL,
  formatDateTime,
  formatMoney,
  getFreshDisplayAmountCents,
  getFulfillmentMeta,
  getItemCount,
  getNextActionHintForOrder,
  getOrderMainItemSummary,
  getOrderPickupOrTrackingLabel,
  getOrderStoreName,
  getStatusMetaForOrder,
  isFreshPreorder
} from '../../../lib/orders';

type OrderWorkbenchFilter =
  | 'ALL'
  | 'PAID_PENDING_SHIPMENT'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'STORE_PICKUP'
  | 'READY_FOR_PICKUP';

const FILTER_OPTIONS: Array<{
  id: OrderWorkbenchFilter;
  label: string;
  description: string;
}> = [
  { id: 'ALL', label: '全部', description: '查看当前作业台的全部订单。' },
  { id: 'PAID_PENDING_SHIPMENT', label: '待发货', description: '优先处理已支付但尚未创建物流的邮寄订单。' },
  { id: 'SHIPPED', label: '已发货', description: '查看已生成物流、等待妥投确认的订单。' },
  { id: 'DELIVERED', label: '已送达', description: '回看已完成配送的邮寄订单。' },
  { id: 'STORE_PICKUP', label: '自提单', description: '聚焦所有到店自提订单。' },
  { id: 'READY_FOR_PICKUP', label: '待取货', description: '查看已备货完成、等待顾客到店取货的订单。' }
];

export default function StoreWorkbenchOrdersPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState<OrderWorkbenchFilter>('ALL');

  async function load() {
    setLoading(true);
    setError('');

    try {
      const data = await storeApi.orders();
      setOrders(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载订单失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const activeFilterMeta = FILTER_OPTIONS.find((option) => option.id === activeFilter) || FILTER_OPTIONS[0];

  const filteredOrders = useMemo(() => {
    switch (activeFilter) {
      case 'PAID_PENDING_SHIPMENT':
      case 'SHIPPED':
      case 'DELIVERED':
      case 'READY_FOR_PICKUP':
        return orders.filter((order) => order.status === activeFilter);
      case 'STORE_PICKUP':
        return orders.filter((order) => order.fulfillmentType === 'STORE_PICKUP');
      case 'ALL':
      default:
        return orders;
    }
  }, [activeFilter, orders]);

  return (
    <AdminPage
      eyebrow="订单作业台"
      title="处理待跟进的订单"
      description="快速识别订单状态、自提或发货类型，并进入详情页完成正确的下一步履约动作。"
      breadcrumbs={[
        { label: '控制台首页', href: '/' },
        { label: '订单作业台' }
      ]}
      actions={
        <div className="admin-hero-actions">
          <Link className="admin-button-secondary" href="/">
            返回控制台
          </Link>
          <button className="admin-button-ghost" type="button" onClick={load}>
            刷新列表
          </button>
        </div>
      }
    >
      {error ? <AdminAlert title="加载作业台订单失败" message={error} /> : null}

      <AdminSection
        title="订单队列"
        description="当前视图优先优化后台扫读效率，未打开详情前也能快速看到状态、履约方式、件数、金额和下一步。"
      >
        <div className="admin-summary-stack">
          <div className="admin-actions-row">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.id}
                className={activeFilter === option.id ? 'admin-button' : 'admin-button-secondary'}
                type="button"
                onClick={() => setActiveFilter(option.id)}
                disabled={loading}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="admin-info-panel">
            <span className="admin-info-title">当前筛选</span>
            <p className="admin-helper">{activeFilterMeta.description}</p>
            {!loading ? (
              <p className="admin-helper">
                当前显示 {filteredOrders.length} / {orders.length} 条订单。
              </p>
            ) : null}
          </div>
        </div>

        {loading ? (
          <AdminLoadingBlocks count={4} />
        ) : orders.length === 0 ? (
          <AdminEmpty
            title="作业台暂无订单"
            message="顾客下单并进入门店侧履约流程后，订单会显示在这里。"
            action={
              <div className="admin-actions-row">
                <Link className="admin-button" href="/">
                  返回控制台
                </Link>
              </div>
            }
          />
        ) : filteredOrders.length === 0 ? (
          <AdminEmpty
            title={`当前筛选下暂无“${activeFilterMeta.label}”订单`}
            message="可以切换到其他筛选查看不同状态或履约方式的订单。"
            action={
              <div className="admin-actions-row">
                <button className="admin-button" type="button" onClick={() => setActiveFilter('ALL')}>
                  查看全部订单
                </button>
              </div>
            }
          />
        ) : (
          <div className="admin-list">
            {filteredOrders.map((order) => {
              // Phase 2.49D：鲜鱼预订单覆写状态徽标/描述/下一步文案，避免被误读为普通「待支付」。
              const fresh = isFreshPreorder(order);
              const statusMeta = getStatusMetaForOrder(order);
              const fulfillmentMeta = getFulfillmentMeta(order.fulfillmentType);
              const logistics = getOrderPickupOrTrackingLabel(order);

              return (
                <article key={order.id} className="admin-order-card">
                  <div className="admin-order-header">
                    <div className="admin-title-stack">
                      <h2 className="admin-section-title">{order.orderNo}</h2>
                      <p className="admin-helper">下单时间：{formatDateTime(order.createdAt)}</p>
                    </div>
                    <div className="admin-badges">
                      {fresh ? <AdminBadge tone="success">{FRESH_PREORDER_BADGE_LABEL}</AdminBadge> : null}
                      <AdminBadge tone={statusMeta.tone}>{statusMeta.label}</AdminBadge>
                      <AdminBadge tone="neutral">{fulfillmentMeta.label}</AdminBadge>
                    </div>
                  </div>

                  <div className="admin-order-row">
                    <div className="admin-title-stack">
                      <h3 className="admin-item-title">{getOrderMainItemSummary(order)}</h3>
                      <p className="admin-helper">{statusMeta.description}</p>
                      <p className="admin-helper">{getNextActionHintForOrder(order)}</p>
                    </div>
                    <div className="admin-kpi">
                      <span className="admin-kpi-label">{fresh ? (getFreshDisplayAmountCents(order).isFinal ? '最终金额' : '参考金额') : '订单金额'}</span>
                      <span className="admin-kpi-value">
                        {fresh ? formatMoney(getFreshDisplayAmountCents(order).amountCents) : formatMoney(order.totalAmountCents)}
                      </span>
                    </div>
                  </div>

                  <dl className="admin-summary-list">
                    <div className="admin-summary-row">
                      <dt>门店</dt>
                      <dd>{getOrderStoreName(order)}</dd>
                    </div>
                    <div className="admin-summary-row">
                      <dt>商品数量</dt>
                      <dd>{getItemCount(order.items)} 件</dd>
                    </div>
                    <div className="admin-summary-row">
                      <dt>履约方式</dt>
                      <dd>{fulfillmentMeta.label}</dd>
                    </div>
                    <div className="admin-summary-row">
                      <dt>{logistics.label}</dt>
                      <dd>{logistics.value}</dd>
                    </div>
                  </dl>

                  <div className="admin-card-actions">
                    <Link className="admin-button" href={`/workbench/orders/${order.id}`}>
                      查看订单详情
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </AdminSection>
    </AdminPage>
  );
}
