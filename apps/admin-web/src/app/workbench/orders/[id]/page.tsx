'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AdminAlert, AdminBadge, AdminEmpty, AdminLoadingBlocks, AdminPage, AdminSection } from '../../../../components/admin-ui';
import { storeApi, type OrderDetail, type OrderNoteEntry, type ShipOrderPayload } from '../../../../lib/api';
import {
  FRESH_PREORDER_BADGE_LABEL,
  FRESH_PREORDER_STATUS_DESCRIPTION,
  FRESH_PREORDER_STATUS_LABEL,
  formatDateTime,
  formatMoney,
  formatStatusLogReason,
  getFreshStageLabel,
  getFulfillmentMeta,
  getItemCount,
  getNextActionHintForOrder,
  getOrderItemDisplayName,
  getOrderItemSkuCode,
  getOrderItemSpecName,
  getOrderStoreName,
  getShippingFormHint,
  getStatusMeta,
  getStatusMetaForOrder,
  isFreshPreorder
} from '../../../../lib/orders';

export default function WorkbenchOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [acting, setActing] = useState<'refresh' | 'ready' | 'pickup' | 'ship' | 'deliver' | 'cancel' | null>(null);
  const [shippingForm, setShippingForm] = useState<ShipOrderPayload>({
    courierCompany: '',
    trackingNumber: ''
  });
  // Phase 2.40B：发货备注 / 取消原因 / 内部备注
  const [shippingNote, setShippingNote] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [notes, setNotes] = useState<OrderNoteEntry[]>([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  // Phase 2.49H：鲜鱼预订处理表单与忙碌态
  const [freshBusy, setFreshBusy] = useState(false);
  const [freshForm, setFreshForm] = useState({
    actualWeightJin: '',
    actualUnitPriceYuan: '',
    finalTotalYuan: '',
    storeConfirmNote: '',
    customerContactNote: ''
  });
  const [freshCancelReason, setFreshCancelReason] = useState('');

  async function load() {
    if (!params?.id) return;

    setLoading(true);
    setError('');

    try {
      const data = await storeApi.order(params.id);
      setOrder(data);
      setShippingForm({
        courierCompany: data.shipment?.courierCompany || '',
        trackingNumber: data.shipment?.trackingNumber || ''
      });
      try {
        const noteRows = await storeApi.orderNotes(params.id);
        setNotes(noteRows);
      } catch {
        // 备注加载失败不阻断订单详情
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载订单失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [params?.id]);

  async function runAction(
    kind: 'ready' | 'pickup' | 'ship' | 'deliver',
    action: () => Promise<unknown>,
    message: string,
    confirmMessage: string
  ) {
    if (!window.confirm(confirmMessage)) return;

    try {
      setActing(kind);
      setFeedback(message);
      setError('');
      await action();
      await load();
      setFeedback('操作已完成，订单详情已刷新。');
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败');
      setFeedback('');
    } finally {
      setActing(null);
    }
  }

  // Phase 2.40B：添加内部备注（仅后台可见）。
  async function addNote() {
    if (!params?.id) return;
    const body = noteDraft.trim();
    if (!body) {
      setError('备注内容不能为空');
      return;
    }
    try {
      setAddingNote(true);
      setError('');
      await storeApi.addOrderNote(params.id, { type: 'internal', body });
      setNoteDraft('');
      const noteRows = await storeApi.orderNotes(params.id);
      setNotes(noteRows);
      setFeedback('内部备注已添加。');
    } catch (e) {
      setError(e instanceof Error ? e.message : '添加备注失败');
    } finally {
      setAddingNote(false);
    }
  }

  // Phase 2.40C：撤回（软删除）内部备注。
  async function revokeNote(noteId: string) {
    if (!params?.id) return;
    if (!window.confirm('确认撤回该内部备注？\n这是后台软删除（不会硬删除、保留审计记录），撤回后默认不再显示；该备注顾客本来就看不到。')) return;
    try {
      setError('');
      await storeApi.softDeleteOrderNote(params.id, noteId);
      const noteRows = await storeApi.orderNotes(params.id);
      setNotes(noteRows);
      setFeedback('内部备注已撤回（软删除）。');
    } catch (e) {
      setError(e instanceof Error ? e.message : '撤回备注失败');
    }
  }

  // Phase 2.49H：鲜鱼预订——确认称重/填最终价。
  async function freshConfirm() {
    if (!params?.id) return;
    const weight = Number(freshForm.actualWeightJin);
    if (!(weight > 0)) {
      setError('请填写实际重量（斤，>0）。');
      return;
    }
    const unitYuan = freshForm.actualUnitPriceYuan.trim();
    const totalYuan = freshForm.finalTotalYuan.trim();
    if (!unitYuan && !totalYuan) {
      setError('请至少填写实际单价或最终总价之一。');
      return;
    }
    if (!window.confirm(`确认门店称重并提交？\n实际重量：${weight} 斤\n该订单为鲜鱼预订，线下结算，不在线支付。`)) return;
    try {
      setFreshBusy(true);
      setError('');
      setFeedback('正在提交门店称重确认…');
      await storeApi.freshPreorderConfirm(params.id, {
        actualWeightJin: weight,
        actualUnitPriceCents: unitYuan ? Math.round(Number(unitYuan) * 100) : undefined,
        finalTotalCents: totalYuan ? Math.round(Number(totalYuan) * 100) : undefined,
        storeConfirmNote: freshForm.storeConfirmNote.trim() || undefined,
        customerContactNote: freshForm.customerContactNote.trim() || undefined
      });
      setFreshForm({ actualWeightJin: '', actualUnitPriceYuan: '', finalTotalYuan: '', storeConfirmNote: '', customerContactNote: '' });
      await load();
      setFeedback('已确认门店称重，进入待取货/线下结算。');
    } catch (e) {
      setError(e instanceof Error ? e.message : '确认失败');
      setFeedback('');
    } finally {
      setFreshBusy(false);
    }
  }

  // Phase 2.49H：鲜鱼预订——完成线下结算。
  async function freshComplete() {
    if (!params?.id) return;
    if (!window.confirm('确认该鲜鱼预订已线下结算并完成取货？此操作不在线支付。')) return;
    try {
      setFreshBusy(true);
      setError('');
      setFeedback('正在标记完成…');
      await storeApi.freshPreorderComplete(params.id);
      await load();
      setFeedback('鲜鱼预订已完成（线下结算）。');
    } catch (e) {
      setError(e instanceof Error ? e.message : '完成失败');
      setFeedback('');
    } finally {
      setFreshBusy(false);
    }
  }

  // Phase 2.49H：鲜鱼预订——取消（必填原因）。
  async function freshCancel() {
    if (!params?.id) return;
    if (!freshCancelReason.trim()) {
      setError('请填写取消原因。');
      return;
    }
    if (!window.confirm('确认取消该鲜鱼预订？将记录取消原因。')) return;
    try {
      setFreshBusy(true);
      setError('');
      setFeedback('正在取消鲜鱼预订…');
      await storeApi.freshPreorderCancel(params.id, freshCancelReason.trim());
      setFreshCancelReason('');
      await load();
      setFeedback('鲜鱼预订已取消。');
    } catch (e) {
      setError(e instanceof Error ? e.message : '取消失败');
      setFeedback('');
    } finally {
      setFreshBusy(false);
    }
  }

  // Phase 2.40B：取消订单（可填原因，写入状态时间线）。
  async function cancelOrder() {
    if (!params?.id || !order) return;
    if (!window.confirm('确认取消该订单？此操作会变更订单状态，可填写取消原因。')) return;
    try {
      setActing('cancel');
      setError('');
      setFeedback('正在取消订单…');
      await storeApi.cancel(params.id, cancelReason.trim() || undefined);
      setCancelReason('');
      await load();
      setFeedback('订单已取消，详情已刷新。');
    } catch (e) {
      setError(e instanceof Error ? e.message : '取消订单失败');
      setFeedback('');
    } finally {
      setActing(null);
    }
  }

  // Phase 2.49D：鲜鱼预订单覆写状态语义，避免误读为普通「待支付」。
  const fresh = order ? isFreshPreorder(order) : false;
  const statusMeta = order ? getStatusMetaForOrder(order) : null;
  const fulfillmentMeta = order ? getFulfillmentMeta(order.fulfillmentType) : null;
  const canReady = order?.fulfillmentType === 'STORE_PICKUP' && order.status === 'PAID_PENDING_PREP';
  const canCompletePickup = order?.fulfillmentType === 'STORE_PICKUP' && order.status === 'READY_FOR_PICKUP';
  const canShip = order?.fulfillmentType === 'SHIPPING' && order.status === 'PAID_PENDING_SHIPMENT';
  const canDeliver = order?.fulfillmentType === 'SHIPPING' && order.status === 'SHIPPED';
  const canCancel = order?.status === 'PENDING_PAYMENT' && acting === null;
  const shippingCourierCompany = shippingForm.courierCompany.trim();
  const shippingTrackingNumber = shippingForm.trackingNumber.trim();
  const canSubmitShipForm = canShip && shippingCourierCompany.length > 0 && shippingTrackingNumber.length > 0 && acting === null;
  const subtotalAmountCents = order?.subtotalAmountCents ?? order?.totalAmountCents ?? 0;
  const discountAmountCents = order?.discountAmountCents ?? 0;
  const appliedCouponCode = order?.appliedCouponCode?.trim() || '';

  return (
    <AdminPage
      eyebrow="订单详情"
      title={order?.orderNo || '作业台订单'}
      description={
        statusMeta?.description ||
        '查看订单状态、履约信息和商品内容，并完成正确的门店侧下一步动作。'
      }
      breadcrumbs={[
        { label: '控制台首页', href: '/' },
        { label: '订单作业台', href: '/workbench/orders' },
        { label: order?.orderNo || '订单详情' }
      ]}
      actions={
        <div className="admin-hero-actions">
          <Link className="admin-button-secondary" href="/workbench/orders">
            返回列表
          </Link>
          <button
            className="admin-button-ghost"
            type="button"
            onClick={async () => {
              setActing('refresh');
              await load();
              setActing(null);
            }}
            disabled={acting !== null}
          >
            {acting === 'refresh' ? '正在刷新...' : '刷新详情'}
          </button>
        </div>
      }
    >
      {error ? <AdminAlert title="加载订单详情失败" message={error} /> : null}
      {feedback ? <AdminAlert title="作业台更新" message={feedback} tone="info" /> : null}
      {/* Phase 2.49D：鲜鱼预订单顶部醒目提示，明确不在线支付、以门店称重为准。 */}
      {fresh ? (
        <AdminAlert
          title={`${FRESH_PREORDER_BADGE_LABEL} · ${FRESH_PREORDER_STATUS_LABEL}`}
          message={`${FRESH_PREORDER_STATUS_DESCRIPTION}本订单不在线支付，请勿等待线上付款。`}
          tone="info"
        />
      ) : null}

      {loading ? (
        <AdminLoadingBlocks count={2} />
      ) : !order || !statusMeta || !fulfillmentMeta ? (
        <AdminEmpty
          title="订单不可用"
          message="当前无法加载该订单，请返回订单列表后重新打开。"
          action={
            <div className="admin-actions-row">
              <Link className="admin-button" href="/workbench/orders">
                返回订单列表
              </Link>
            </div>
          }
        />
      ) : (
        <div className="admin-grid">
          <div className="admin-main">
            <AdminSection
              title="状态概览"
              description="优先展示状态与下一步提示，方便运营快速判断当前可执行动作。"
            >
              <div className="admin-status-header">
                <div className="admin-title-stack">
                  <div className="admin-badges">
                    {fresh ? <AdminBadge tone="success">{FRESH_PREORDER_BADGE_LABEL}</AdminBadge> : null}
                    <AdminBadge tone={statusMeta.tone}>{statusMeta.label}</AdminBadge>
                    <AdminBadge tone="neutral">{fulfillmentMeta.label}</AdminBadge>
                  </div>
                  <p className="admin-helper">{getNextActionHintForOrder(order)}</p>
                </div>
                <div className="admin-kpi">
                  <span className="admin-kpi-label">订单金额</span>
                  <span className="admin-kpi-value">{formatMoney(order.totalAmountCents)}</span>
                </div>
              </div>

              <dl className="admin-summary-list">
                <div className="admin-summary-row">
                  <dt>下单时间</dt>
                  <dd>{formatDateTime(order.createdAt)}</dd>
                </div>
                <div className="admin-summary-row">
                  <dt>门店</dt>
                  <dd>{getOrderStoreName(order)}</dd>
                </div>
                <div className="admin-summary-row">
                  <dt>件数</dt>
                  <dd>{getItemCount(order.items)} 件</dd>
                </div>
                <div className="admin-summary-row">
                  <dt>履约说明</dt>
                  <dd>{fulfillmentMeta.description}</dd>
                </div>
              </dl>
            </AdminSection>

            {fresh ? (
              <AdminSection
                title="鲜鱼预订处理"
                description="鲜鱼预订以门店称重确认为准、线下结算，不在线支付。按当前阶段执行确认 / 完成 / 取消。"
              >
                <dl className="admin-summary-list">
                  <div className="admin-summary-row">
                    <dt>当前阶段</dt>
                    <dd>{getFreshStageLabel(order.freshPreorderDetail?.stage)}</dd>
                  </div>
                  <div className="admin-summary-row">
                    <dt>参考金额</dt>
                    <dd>{order.freshPreorderDetail?.estimatedTotalCents != null ? formatMoney(order.freshPreorderDetail.estimatedTotalCents) : formatMoney(order.totalAmountCents)}</dd>
                  </div>
                  <div className="admin-summary-row">
                    <dt>实际重量</dt>
                    <dd>{order.freshPreorderDetail?.actualWeightJin != null ? `${order.freshPreorderDetail.actualWeightJin} 斤` : '—'}</dd>
                  </div>
                  <div className="admin-summary-row">
                    <dt>实际单价</dt>
                    <dd>{order.freshPreorderDetail?.actualUnitPriceCents != null ? `${formatMoney(order.freshPreorderDetail.actualUnitPriceCents)} / 斤` : '—'}</dd>
                  </div>
                  <div className="admin-summary-row">
                    <dt>最终金额</dt>
                    <dd>{order.freshPreorderDetail?.finalTotalCents != null ? formatMoney(order.freshPreorderDetail.finalTotalCents) : '—'}</dd>
                  </div>
                  <div className="admin-summary-row">
                    <dt>门店确认备注</dt>
                    <dd>{order.freshPreorderDetail?.storeConfirmNote || '—'}</dd>
                  </div>
                  <div className="admin-summary-row">
                    <dt>客户联系备注</dt>
                    <dd>{order.freshPreorderDetail?.customerContactNote || '—'}</dd>
                  </div>
                  <div className="admin-summary-row">
                    <dt>取消原因</dt>
                    <dd>{order.freshPreorderDetail?.cancelReason || '—'}</dd>
                  </div>
                  <div className="admin-summary-row">
                    <dt>确认时间</dt>
                    <dd>{order.freshPreorderDetail?.confirmedAt ? formatDateTime(order.freshPreorderDetail.confirmedAt) : '—'}</dd>
                  </div>
                  <div className="admin-summary-row">
                    <dt>完成时间</dt>
                    <dd>{order.freshPreorderDetail?.completedAt ? formatDateTime(order.freshPreorderDetail.completedAt) : '—'}</dd>
                  </div>
                  <div className="admin-summary-row">
                    <dt>取消时间</dt>
                    <dd>{order.freshPreorderDetail?.cancelledAt ? formatDateTime(order.freshPreorderDetail.cancelledAt) : '—'}</dd>
                  </div>
                </dl>

                {order.freshPreorderDetail?.stage === 'PENDING_STORE_CONFIRMATION' ? (
                  <div className="admin-info-panel">
                    <span className="admin-info-title">门店称重确认</span>
                    <p className="admin-helper">填写实际重量，并填写实际单价或最终总价之一（不在线支付）。</p>
                    <label className="admin-form-field">
                      <span className="admin-info-title">实际重量（斤）</span>
                      <input className="admin-input" type="number" step="0.01" min="0" value={freshForm.actualWeightJin}
                        onChange={(e) => setFreshForm({ ...freshForm, actualWeightJin: e.target.value })} disabled={freshBusy} />
                    </label>
                    <label className="admin-form-field">
                      <span className="admin-info-title">实际单价（元/斤，可选）</span>
                      <input className="admin-input" type="number" step="0.01" min="0" value={freshForm.actualUnitPriceYuan}
                        onChange={(e) => setFreshForm({ ...freshForm, actualUnitPriceYuan: e.target.value })} disabled={freshBusy} />
                    </label>
                    <label className="admin-form-field">
                      <span className="admin-info-title">最终总价（元，可选）</span>
                      <input className="admin-input" type="number" step="0.01" min="0" value={freshForm.finalTotalYuan}
                        onChange={(e) => setFreshForm({ ...freshForm, finalTotalYuan: e.target.value })} disabled={freshBusy} />
                    </label>
                    <label className="admin-form-field">
                      <span className="admin-info-title">门店确认备注（可选）</span>
                      <textarea className="admin-textarea" maxLength={2000} value={freshForm.storeConfirmNote}
                        onChange={(e) => setFreshForm({ ...freshForm, storeConfirmNote: e.target.value })} disabled={freshBusy} />
                    </label>
                    <label className="admin-form-field">
                      <span className="admin-info-title">客户联系备注（可选）</span>
                      <textarea className="admin-textarea" maxLength={2000} value={freshForm.customerContactNote}
                        onChange={(e) => setFreshForm({ ...freshForm, customerContactNote: e.target.value })} disabled={freshBusy} />
                    </label>
                    <div className="admin-actions-row">
                      <button className="admin-button" type="button" disabled={freshBusy} onClick={freshConfirm}>
                        {freshBusy ? '正在提交...' : '确认称重 / 填写最终价'}
                      </button>
                    </div>
                  </div>
                ) : null}

                {order.freshPreorderDetail?.stage === 'CONFIRMED_WAITING_PICKUP' ? (
                  <div className="admin-info-panel">
                    <span className="admin-info-title">完成线下结算</span>
                    <p className="admin-helper">顾客到店称重取货、线下结算后点击完成（不在线支付）。</p>
                    <div className="admin-actions-row">
                      <button className="admin-button" type="button" disabled={freshBusy} onClick={freshComplete}>
                        {freshBusy ? '正在标记...' : '完成线下结算'}
                      </button>
                    </div>
                  </div>
                ) : null}

                {order.freshPreorderDetail?.stage === 'PENDING_STORE_CONFIRMATION' ||
                order.freshPreorderDetail?.stage === 'CONFIRMED_WAITING_PICKUP' ? (
                  <div className="admin-info-panel">
                    <span className="admin-info-title">取消鲜鱼预订</span>
                    <label className="admin-form-field">
                      <span className="admin-info-title">取消原因（必填）</span>
                      <textarea className="admin-textarea" maxLength={2000} value={freshCancelReason}
                        onChange={(e) => setFreshCancelReason(e.target.value)} disabled={freshBusy} placeholder="如：无货 / 顾客取消" />
                    </label>
                    <div className="admin-actions-row">
                      <button className="admin-button-secondary" type="button" disabled={freshBusy} onClick={freshCancel}>
                        {freshBusy ? '正在取消...' : '取消鲜鱼预订'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </AdminSection>
            ) : null}

            <AdminSection
              title="商品与金额"
              description="将数量、单价和小计放在一起，方便快速核对订单内容。"
            >
              <div className="admin-info-panel">
                <span className="admin-info-title">价格快照</span>
                <dl className="admin-summary-list">
                  <div className="admin-summary-row">
                    <dt>原价小计</dt>
                    <dd>{formatMoney(subtotalAmountCents)}</dd>
                  </div>
                  <div className="admin-summary-row">
                    <dt>订单优惠</dt>
                    <dd>{formatMoney(discountAmountCents)}</dd>
                  </div>
                  <div className="admin-summary-row">
                    <dt>实付金额</dt>
                    <dd>{formatMoney(order.totalAmountCents)}</dd>
                  </div>
                  <div className="admin-summary-row">
                    <dt>生效券码</dt>
                    <dd>{appliedCouponCode || '未使用优惠券'}</dd>
                  </div>
                </dl>
              </div>
              <div className="admin-item-list">
                {order.items.map((item) => (
                  <div key={item.id} className="admin-item-card">
                    <div className="admin-item-header">
                      <div className="admin-title-stack">
                        <h3 className="admin-item-title">{getOrderItemDisplayName(item)}</h3>
                        <p className="admin-helper">规格：{getOrderItemSpecName(item)}</p>
                        <p className="admin-helper">规格编码：{getOrderItemSkuCode(item)}</p>
                      </div>
                      <div className="admin-item-price">
                        <div className="admin-item-price-label">小计</div>
                        <div className="admin-item-price-value">{formatMoney(item.unitPriceCents * item.quantity)}</div>
                      </div>
                    </div>
                    <p className="admin-helper">数量：{item.quantity} · 单价：{formatMoney(item.unitPriceCents)}</p>
                  </div>
                ))}
              </div>
            </AdminSection>

            <AdminSection
              title={order.fulfillmentType === 'STORE_PICKUP' ? '自提处理信息' : '发货处理信息'}
              description="按履约方式拆分关键信息，方便门店人员聚焦当前订单真正需要的字段。"
            >
              {order.fulfillmentType === 'STORE_PICKUP' ? (
                <div className="admin-info-grid">
                  <div className="admin-info-panel">
                    <span className="admin-info-title">提货码</span>
                    <div className="admin-code">{order.pickupRecord?.pickupCode || '暂未生成'}</div>
                    <p className="admin-helper">顾客到店取货时请使用该提货码完成核销。</p>
                  </div>
                  <div className="admin-info-panel">
                    <span className="admin-info-title">提货安排</span>
                    <p className="admin-helper">提货门店：{getOrderStoreName(order)}</p>
                    <p className="admin-helper">门店地址：{order.store?.address || '暂未填写门店地址'}</p>
                    <p className="admin-helper">提货日期：{formatDateTime(order.pickupDate)}</p>
                    <p className="admin-helper">时间段：{order.pickupTimeSlot || '暂未设置'}</p>
                    <p className="admin-helper">完成取货时间：{formatDateTime(order.pickupRecord?.pickedUpAt)}</p>
                  </div>
                </div>
              ) : (
                <div className="admin-info-grid">
                  <div className="admin-info-panel">
                    <span className="admin-info-title">收货地址</span>
                    <p className="admin-helper">
                      {order.shippingAddress
                        ? `${order.shippingAddress.receiverName}, ${order.shippingAddress.phone}`
                        : '暂无地址快照'}
                    </p>
                    <p className="admin-helper">
                      {order.shippingAddress
                        ? `${order.shippingAddress.province} ${order.shippingAddress.city} ${order.shippingAddress.district} ${order.shippingAddress.detail}`
                        : '地址详情暂不可用'}
                    </p>
                  </div>
                  <div className="admin-info-panel">
                    <span className="admin-info-title">物流跟踪</span>
                    <p className="admin-helper">快递公司：{order.shipment?.courierCompany || '暂未发货'}</p>
                    <p className="admin-helper">运单号：{order.shipment?.trackingNumber || '暂未生成'}</p>
                    <p className="admin-helper">发货时间：{formatDateTime(order.shipment?.shippedAt)}</p>
                    <p className="admin-helper">送达时间：{formatDateTime(order.shipment?.deliveredAt)}</p>
                  </div>
                </div>
              )}
            </AdminSection>

            <AdminSection
              title="状态时间线"
              description="通过易读时间线展示订单推进过程，方便回看状态变化。"
            >
              {order.statusLogs.length === 0 ? (
                <p className="admin-helper">当前还没有状态日志。</p>
              ) : (
                <div className="admin-timeline">
                  {order.statusLogs.map((log) => {
                    const logMeta = getStatusMeta(log.toStatus);
                    return (
                      <div key={log.id} className="admin-timeline-item">
                        <div className="admin-timeline-dot" />
                        <div className="admin-timeline-content">
                          <div className="admin-timeline-header">
                            <AdminBadge tone={logMeta.tone}>{logMeta.label}</AdminBadge>
                            <span className="admin-helper">{formatDateTime(log.createdAt)}</span>
                          </div>
                          <p className="admin-helper">{formatStatusLogReason(log.reason)}</p>
                          <p className="admin-helper">操作人：{log.operatorAdmin?.displayName || log.operatorAdmin?.username || (log.operatorAdminId ? log.operatorAdminId : '系统')}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </AdminSection>

            <AdminSection
              title="内部备注 / 处理记录"
              description="仅后台可见，不会展示给顾客。可记录客服沟通、处理过程、特殊情况。"
            >
              <div className="admin-form-field">
                <label htmlFor="order-note-input">添加内部备注</label>
                <textarea
                  id="order-note-input"
                  className="admin-textarea"
                  value={noteDraft}
                  maxLength={2000}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  placeholder="仅后台可见，不会展示给顾客"
                />
                <div className="admin-actions-row">
                  <button className="admin-button" type="button" disabled={addingNote || !noteDraft.trim()} onClick={addNote}>
                    {addingNote ? '正在添加...' : '添加备注'}
                  </button>
                </div>
              </div>
              {notes.length === 0 ? (
                <p className="admin-helper">暂无内部备注。</p>
              ) : (
                <div className="admin-timeline">
                  {notes.map((note) => (
                    <div key={note.id} className="admin-timeline-item">
                      <div className="admin-timeline-dot" />
                      <div className="admin-timeline-content">
                        <div className="admin-timeline-header">
                          <AdminBadge tone="neutral">{note.type === 'internal' ? '内部备注' : note.type}</AdminBadge>
                          <span className="admin-helper">{formatDateTime(note.createdAt)}</span>
                        </div>
                        <p>{note.body}</p>
                        <p className="admin-helper">操作人：{note.author?.displayName || note.author?.username || (note.authorAdminId ? note.authorAdminId : '系统')} · 仅后台可见</p>
                        <div className="admin-actions-row">
                          <button className="admin-button-secondary" type="button" onClick={() => revokeNote(note.id)}>
                            撤回备注
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AdminSection>
          </div>

          <aside className="admin-sidebar">
            <AdminSection
              title="主要动作"
              description="按照流程优先级展示动作，只有当前状态允许的动作才可点击。"
            >
              <div className="admin-summary-stack">
                <div className="admin-actions-row">
                  <button
                    className="admin-button"
                    type="button"
                    disabled={!canReady || acting !== null}
                    onClick={() =>
                      runAction(
                        'ready',
                        () => storeApi.ready(order.id),
                        '正在标记待取货并刷新详情...',
                        '确认该订单已经备货完成，并标记为待取货吗？'
                      )
                    }
                  >
                    {acting === 'ready' ? '正在标记...' : '标记待取货'}
                  </button>
                  <button
                    className="admin-button-secondary"
                    type="button"
                    disabled={!canCompletePickup || acting !== null}
                    onClick={() =>
                      runAction(
                        'pickup',
                        () => storeApi.completePickup(order.id, order.pickupRecord?.pickupCode || ''),
                        '正在使用当前提货码完成取货...',
                        '确认已经核验顾客提货码，并完成本次取货吗？'
                      )
                    }
                  >
                    {acting === 'pickup' ? '正在完成取货...' : '完成取货'}
                  </button>
                  <button
                    className="admin-button"
                    type="button"
                    disabled={!canSubmitShipForm}
                    onClick={() =>
                      runAction(
                        'ship',
                        () =>
                          storeApi.ship(order.id, {
                            courierCompany: shippingCourierCompany,
                            trackingNumber: shippingTrackingNumber,
                            shippingNote: shippingNote.trim() || undefined
                          }),
                        '正在提交发货信息并刷新订单详情...',
                        `确认使用“${shippingCourierCompany} / ${shippingTrackingNumber}”发货吗？`
                      )
                    }
                  >
                    {acting === 'ship' ? '正在确认发货...' : '确认发货'}
                  </button>
                  <button
                    className="admin-button-secondary"
                    type="button"
                    disabled={!canDeliver || acting !== null}
                    onClick={() =>
                      runAction(
                        'deliver',
                        () => storeApi.deliver(order.id),
                        '正在标记已送达并刷新订单详情...',
                        '确认物流已经送达，并将订单标记为已送达吗？'
                      )
                    }
                  >
                    {acting === 'deliver' ? '正在标记...' : '标记已送达'}
                  </button>
                </div>

                <div className="admin-info-panel">
                  <span className="admin-info-title">当前优先动作</span>
                  <p className="admin-helper">{getNextActionHintForOrder(order)}</p>
                </div>

                {canCancel ? (
                  <div className="admin-info-panel">
                    <span className="admin-info-title">取消订单</span>
                    <p className="admin-helper">仅待支付订单可取消；取消原因会写入状态时间线。</p>
                    <label className="admin-form-field">
                      <span className="admin-info-title">取消原因（可选）</span>
                      <textarea
                        className="admin-textarea"
                        value={cancelReason}
                        maxLength={2000}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="可选：填写取消原因"
                        disabled={acting === 'cancel'}
                      />
                    </label>
                    <div className="admin-actions-row">
                      <button className="admin-button-secondary" type="button" disabled={acting !== null} onClick={cancelOrder}>
                        {acting === 'cancel' ? '正在取消...' : '取消订单'}
                      </button>
                    </div>
                  </div>
                ) : null}

                {order.fulfillmentType === 'SHIPPING' ? (
                  <div className="admin-info-panel">
                    <span className="admin-info-title">发货录入</span>
                    <p className="admin-helper">{getShippingFormHint(order.status)}</p>

                    <label className="admin-form-field">
                      <span className="admin-info-title">快递公司</span>
                      <input
                        className="admin-input"
                        type="text"
                        value={shippingForm.courierCompany}
                        onChange={(e) => {
                          setShippingForm((current) => ({ ...current, courierCompany: e.target.value }));
                          if (error) setError('');
                        }}
                        placeholder="例如：顺丰速运"
                        disabled={!canShip || acting === 'ship'}
                      />
                    </label>

                    <label className="admin-form-field">
                      <span className="admin-info-title">运单号</span>
                      <input
                        className="admin-input"
                        type="text"
                        value={shippingForm.trackingNumber}
                        onChange={(e) => {
                          setShippingForm((current) => ({ ...current, trackingNumber: e.target.value }));
                          if (error) setError('');
                        }}
                        placeholder="请输入物流运单号"
                        disabled={!canShip || acting === 'ship'}
                      />
                    </label>

                    <label className="admin-form-field">
                      <span className="admin-info-title">发货备注（可选，仅后台）</span>
                      <textarea
                        className="admin-textarea"
                        value={shippingNote}
                        maxLength={2000}
                        onChange={(e) => setShippingNote(e.target.value)}
                        placeholder="可选：发货说明，写入状态时间线，不展示给顾客"
                        disabled={!canShip || acting === 'ship'}
                      />
                    </label>

                    {!canShip ? (
                      <p className="admin-helper">当前订单不处于待发货状态，发货表单不可提交。</p>
                    ) : !canSubmitShipForm ? (
                      <p className="admin-helper">请先填写快递公司和运单号后再确认发货。</p>
                    ) : (
                      <p className="admin-helper">物流信息填写完成后，可点击“确认发货”立即提交并刷新详情。</p>
                    )}
                  </div>
                ) : null}
              </div>
            </AdminSection>
          </aside>
        </div>
      )}
    </AdminPage>
  );
}
