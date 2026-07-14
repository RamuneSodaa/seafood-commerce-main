'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertMessage, Badge, EmptyState, LoadingGrid, PageShell, PriceBlock, SectionCard } from '../../components/ui';
import { getOrders, getStores, type OrderSummary, type StoreSummary } from '../../lib/api';
import { formatDateTime, getFulfillmentMeta, getOrderItemCount, getOrderNextStep, getOrderPrimaryItemLabel, getOrderStatusMeta } from '../../lib/orders';

export default function OrderListPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isActive = true;

    async function loadOrders() {
      setLoading(true);
      setError('');

      try {
        const [ordersData, storesData] = await Promise.all([getOrders(), getStores()]);
        if (!isActive) return;
        setOrders(ordersData);
        setStores(storesData);
      } catch (e) {
        if (isActive) {
          setError(e instanceof Error ? e.message : '加载订单失败');
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    loadOrders();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <PageShell
      eyebrow="我的订单"
      title="查看每一笔订单的当前进度"
      description="快速了解订单状态、自提或发货方式，并进入详情页查看下一步动作。"
      breadcrumbs={[
        { label: '订单' }
      ]}
      actions={
        <>
          <Link className="button-secondary" href="/">
            继续逛商品
          </Link>
          <a className="button-ghost" href="#orders-list">
            跳转到订单列表
          </a>
        </>
      }
    >
      {error ? <AlertMessage title="加载订单失败" message={error} /> : null}

      <SectionCard
        title="最近订单"
        description="订单按摘要卡片展示，方便快速查看状态、履约方式、商品数量、金额和下一步提示。"
      >
        {loading ? (
          <LoadingGrid count={4} />
        ) : orders.length === 0 ? (
          <EmptyState
            title="暂无订单"
            message="完成下单后，订单会显示在这里，并附带状态摘要和履约信息。"
            action={
              <div className="action-row">
                <Link className="button" href="/">
                  浏览商品
                </Link>
              </div>
            }
          />
        ) : (
          <div id="orders-list" className="order-list">
            {orders.map((order) => {
              const store = stores.find((item) => item.id === order.storeId);
              const statusMeta = getOrderStatusMeta(order.status);
              const fulfillmentMeta = getFulfillmentMeta(order.fulfillmentType);

              return (
                <article key={order.id} className="order-card">
                  <div className="order-card-top">
                    <div className="order-card-heading">
                      <h2 className="product-title">{order.orderNo}</h2>
                      <p className="muted-text">
                        下单时间：{formatDateTime(order.createdAt)}
                      </p>
                    </div>
                    <div className="badge-row">
                      <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                      <Badge tone="neutral">{fulfillmentMeta.label}</Badge>
                    </div>
                  </div>

                  <div className="order-card-grid">
                    <div className="order-card-copy">
                      <p className="muted-text">{statusMeta.description}</p>
                      <p className="muted-text">{getOrderNextStep(order)}</p>
                    </div>
                    <PriceBlock label="订单金额" amountCents={order.totalAmountCents} />
                  </div>

                  <dl className="summary-list">
                    <div className="summary-row">
                      <dt>门店</dt>
                      <dd>{store?.name || order.storeId}</dd>
                    </div>
                    <div className="summary-row">
                      <dt>件数</dt>
                      <dd>{getOrderItemCount(order)} 件</dd>
                    </div>
                    <div className="summary-row">
                      <dt>商品摘要</dt>
                      <dd>{getOrderPrimaryItemLabel(order)}</dd>
                    </div>
                    <div className="summary-row">
                      <dt>履约说明</dt>
                      <dd>{fulfillmentMeta.description}</dd>
                    </div>
                  </dl>

                  <div className="card-actions">
                    <Link className="button" href={`/orders/${order.id}`}>
                      查看订单详情
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </SectionCard>
    </PageShell>
  );
}
