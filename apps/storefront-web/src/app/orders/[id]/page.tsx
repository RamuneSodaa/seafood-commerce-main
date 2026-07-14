'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AlertMessage, Badge, EmptyState, PageShell, PriceBlock, SectionCard } from '../../../components/ui';
import { cancelOrder, getOrder, getStores, type OrderDetail, type StoreSummary } from '../../../lib/api';
import { formatPriceCents } from '../../../lib/format';
import { formatDateTime, formatOrderStatusReason, getFulfillmentMeta, getOrderItemCount, getOrderNextStep, getOrderStatusMeta } from '../../../lib/orders';
import { runCustomerPaymentTransition } from '../../../lib/payment-transition';

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [acting, setActing] = useState<'refresh' | 'pay' | 'cancel' | null>(null);

  async function refresh() {
    if (!params?.id) return;
    try {
      setActing('refresh');
      const data = await getOrder(params.id);
      setOrder(data);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载订单失败');
    } finally {
      setActing(null);
    }
  }

  useEffect(() => {
    if (!params?.id) {
      setLoading(false);
      return;
    }

    let isActive = true;

    async function loadPage() {
      setLoading(true);

      try {
        const [orderData, storesData] = await Promise.all([getOrder(params.id), getStores()]);
        if (!isActive) return;
        setOrder(orderData);
        setStores(storesData);
        setError('');
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

    loadPage();

    return () => {
      isActive = false;
    };
  }, [params?.id]);

  const store = useMemo(
    () => stores.find((item) => item.id === order?.storeId) ?? null,
    [stores, order?.storeId]
  );

  const statusMeta = order ? getOrderStatusMeta(order.status) : null;
  const fulfillmentMeta = order ? getFulfillmentMeta(order.fulfillmentType) : null;
  const canPay = order?.status === 'PENDING_PAYMENT';
  const canCancel = Boolean(order && ['PENDING_PAYMENT', 'PAID_PENDING_PREP', 'PAID_PENDING_SHIPMENT', 'READY_FOR_PICKUP'].includes(order.status));
  const subtotalAmountCents = order?.subtotalAmountCents ?? order?.totalAmountCents ?? 0;
  const discountAmountCents = order?.discountAmountCents ?? 0;
  const appliedCouponCode = order?.appliedCouponCode?.trim() || '';

  async function handlePay() {
    if (!params?.id || !order) return;

    try {
      setActing('pay');
      setError('');
      setActionMessage('正在处理支付并刷新订单状态...');
      const result = await runCustomerPaymentTransition({
        orderId: params.id,
        paidAmountCents: order.totalAmountCents
      });

      if (!result.success) {
        setError(result.message);
        setActionMessage('');
        return;
      }

      await refresh();
      setActionMessage(result.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : '支付处理失败');
      setActionMessage('');
    } finally {
      setActing(null);
    }
  }

  async function handleCancel() {
    if (!params?.id) return;

    try {
      setActing('cancel');
      setActionMessage('正在取消订单并刷新最新状态...');
      await cancelOrder(params.id);
      await refresh();
      setActionMessage('订单已取消，最新状态已更新。');
    } catch (e) {
      setError(e instanceof Error ? e.message : '取消订单失败');
      setActionMessage('');
    } finally {
      setActing(null);
    }
  }

  return (
    <PageShell
      eyebrow="订单详情"
      title={order?.orderNo || '订单概览'}
      description={
        statusMeta?.description ||
        '查看订单当前状态、履约信息、商品内容以及下一步可执行动作。'
      }
      breadcrumbs={[
        { label: '订单', href: '/orders' },
        { label: order?.orderNo || '订单详情' }
      ]}
      actions={
        <>
          <Link className="button-secondary" href="/orders">
            返回订单列表
          </Link>
          <Link className="button-ghost" href="/">
            继续逛商品
          </Link>
        </>
      }
    >
      {error ? <AlertMessage title="加载订单详情失败" message={error} /> : null}
      {actionMessage ? <AlertMessage title="订单状态更新" message={actionMessage} /> : null}

      {loading ? (
        <div className="detail-grid">
          <section className="detail-panel">
            <div className="skeleton-card" />
          </section>
          <aside className="detail-panel">
            <div className="skeleton-card" />
          </aside>
        </div>
      ) : !order || !statusMeta || !fulfillmentMeta ? (
        <EmptyState
          title="订单不可用"
          message="当前无法加载该订单，请返回订单列表后重新打开。"
          action={
            <div className="action-row">
              <Link className="button" href="/orders">
                返回订单列表
              </Link>
            </div>
          }
        />
      ) : (
        <div className="detail-grid">
          <div className="detail-main">
            <section className="detail-panel">
              <div className="order-status-header">
                <div className="order-card-heading">
                  <div className="badge-row">
                    <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                    <Badge tone="neutral">{fulfillmentMeta.label}</Badge>
                  </div>
                  <h2 className="section-title">当前状态</h2>
                  <p className="section-copy">{getOrderNextStep(order)}</p>
                </div>
                <PriceBlock label="订单金额" amountCents={order.totalAmountCents} />
              </div>

              <dl className="summary-list">
                <div className="summary-row">
                  <dt>下单时间</dt>
                  <dd>{formatDateTime(order.createdAt)}</dd>
                </div>
                <div className="summary-row">
                  <dt>门店</dt>
                  <dd>{store?.name || order.storeId}</dd>
                </div>
                <div className="summary-row">
                  <dt>商品件数</dt>
                  <dd>{getOrderItemCount(order)} 件</dd>
                </div>
              </dl>
            </section>

            <SectionCard
              title="订单商品"
              description="清晰展示每个商品行的数量和金额，方便确认本次购买内容。"
            >
              <dl className="summary-list">
                <div className="summary-row">
                  <dt>原价小计</dt>
                  <dd>{formatPriceCents(subtotalAmountCents)}</dd>
                </div>
                <div className="summary-row">
                  <dt>订单优惠</dt>
                  <dd>{formatPriceCents(discountAmountCents)}</dd>
                </div>
                <div className="summary-row">
                  <dt>实付金额</dt>
                  <dd>{formatPriceCents(order.totalAmountCents)}</dd>
                </div>
                <div className="summary-row">
                  <dt>生效券码</dt>
                  <dd>{appliedCouponCode || '未使用优惠券'}</dd>
                </div>
              </dl>
              <div className="item-list">
                {order.items.map((item) => (
                  <div key={item.id} className="item-card">
                    <div className="item-card-top">
                      <div>
                        <h3 className="item-title">SKU {item.skuId}</h3>
                        <p className="muted-text">数量：{item.quantity}</p>
                      </div>
                      <div className="item-price-block">
                        <div className="item-price-label">小计</div>
                        <div className="item-price-value">{formatPriceCents(item.unitPriceCents * item.quantity)}</div>
                      </div>
                    </div>
                    <p className="helper-text">
                      单价：{formatPriceCents(item.unitPriceCents)}
                    </p>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title={order.fulfillmentType === 'STORE_PICKUP' ? '自提信息' : '发货信息'}
              description={fulfillmentMeta.description}
            >
              {order.fulfillmentType === 'STORE_PICKUP' ? (
                <div className="info-grid">
                  <div className="info-panel">
                    <span className="checkout-note-label">提货码</span>
                    <div className="pickup-code">{order.pickupRecord?.pickupCode || '订单创建后可见'}</div>
                    <p className="helper-text">
                      {order.status === 'READY_FOR_PICKUP'
                        ? '请携带提货码到门店完成取货。'
                        : '订单可取货时将使用该提货码完成核销。'}
                    </p>
                  </div>
                  <div className="info-panel">
                    <span className="checkout-note-label">提货安排</span>
                    <p className="helper-text">日期：{formatDateTime(order.pickupDate)}</p>
                    <p className="helper-text">时段：{order.pickupTimeSlot || '暂未设置'}</p>
                    <p className="helper-text">完成取货时间：{formatDateTime(order.pickupRecord?.pickedUpAt)}</p>
                  </div>
                </div>
              ) : (
                <div className="info-grid">
                  <div className="info-panel">
                    <span className="checkout-note-label">收货地址</span>
                    <p className="helper-text">
                      {order.shippingAddress
                        ? `${order.shippingAddress.receiverName}, ${order.shippingAddress.phone}`
                        : '暂无收货地址快照'}
                    </p>
                    <p className="helper-text">
                      {order.shippingAddress
                        ? `${order.shippingAddress.province} ${order.shippingAddress.city} ${order.shippingAddress.district} ${order.shippingAddress.detail}`
                        : '地址详情暂未生成。'}
                    </p>
                  </div>
                  <div className="info-panel">
                    <span className="checkout-note-label">物流跟踪</span>
                    <p className="helper-text">快递公司：{order.shipment?.courierCompany || '暂未发货'}</p>
                    <p className="helper-text">运单号：{order.shipment?.trackingNumber || '暂未生成'}</p>
                    <p className="helper-text">发货时间：{formatDateTime(order.shipment?.shippedAt)}</p>
                    <p className="helper-text">送达时间：{formatDateTime(order.shipment?.deliveredAt)}</p>
                  </div>
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="状态时间线"
              description="用易读的时间线展示订单状态变化，方便理解订单推进过程。"
            >
              {order.statusLogs.length === 0 ? (
                <p className="helper-text">当前订单暂时还没有状态日志。</p>
              ) : (
                <div className="timeline-list">
                  {order.statusLogs.map((log) => {
                    const toMeta = getOrderStatusMeta(log.toStatus);
                    return (
                      <div key={log.id} className="timeline-item">
                        <div className="timeline-dot" />
                        <div className="timeline-content">
                          <div className="timeline-top">
                            <Badge tone={toMeta.tone}>{toMeta.label}</Badge>
                            <span className="helper-text">{formatDateTime(log.createdAt)}</span>
                          </div>
                          <p className="helper-text">
                            {formatOrderStatusReason(log.reason)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </div>

          <aside className="checkout-sidebar">
            <SectionCard
              title="顾客可执行动作"
              description="当前页面仅展示顾客在现有流程中合理可执行的动作，并保持与既有逻辑兼容。"
            >
              <div className="summary-stack">
                <div className="action-row">
                  <button className="button-secondary" type="button" onClick={refresh} disabled={acting !== null}>
                    {acting === 'refresh' ? '正在刷新...' : '刷新订单'}
                  </button>
                  {canPay ? (
                    <button className="button" type="button" onClick={handlePay} disabled={acting !== null}>
                      {acting === 'pay' ? '正在支付...' : '模拟支付'}
                    </button>
                  ) : null}
                  {canCancel ? (
                    <button className="button-ghost" type="button" onClick={handleCancel} disabled={acting !== null}>
                      {acting === 'cancel' ? '正在取消...' : '取消订单'}
                    </button>
                  ) : null}
                </div>

                <div className="checkout-info-panel">
                  <h3 className="checkout-info-title">下一步</h3>
                  <p className="helper-text">{getOrderNextStep(order)}</p>
                </div>

                <dl className="summary-list">
                  <div className="summary-row">
                    <dt>履约方式</dt>
                    <dd>{fulfillmentMeta.label}</dd>
                  </div>
                  <div className="summary-row">
                    <dt>状态</dt>
                    <dd>{statusMeta.label}</dd>
                  </div>
                  <div className="summary-row">
                    <dt>门店地址</dt>
                    <dd>{store?.address || '暂未获取门店地址'}</dd>
                  </div>
                </dl>
              </div>
            </SectionCard>
          </aside>
        </div>
      )}
    </PageShell>
  );
}
