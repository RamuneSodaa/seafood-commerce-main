import { useEffect, useMemo, useState } from 'react';
import Taro, { useRouter } from '@tarojs/taro';
import { Button, Image, Text, View } from '@tarojs/components';

import homeHeroImage from '../../assets/brand/home-hero.jpg';
import serviceSoupImage from '../../assets/brand/service-soup.jpg';
import serviceStoreImage from '../../assets/brand/service-store.jpg';
import {
  addCartItem,
  cancelAuthenticatedOrder,
  clearCartItems,
  getAuthenticatedOrder,
  getCart,
  getOrder,
  getStores,
  previewAuthenticatedReorder,
  type OrderDetail,
  type OrderItemSummary,
  type OrderStatus,
  type ReorderPreviewItem,
  type StoreSummary
} from '../../lib/api';
import { redirectToCustomerLogin } from '../../lib/customer-login-redirect';
import { sanitizeProductDisplayName } from '../../lib/product-display-name';
import { getMiniappIdentitySource } from '../../lib/identity';
import { getStoredCustomerAuthArtifact } from '../../lib/identity-storage';
import { runCustomerPaymentTransition } from '../../lib/payment-transition';

function formatPriceCents(amountCents: number): string {
  const value = (Number(amountCents) || 0) / 100;
  return `¥${value.toFixed(2)}`;
}

function formatDateTime(value?: string | null): string {
  if (!value) return '暂未生成';

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getStatusLabel(status: OrderStatus): string {
  switch (status) {
    case 'PENDING_PAYMENT':
      return '待支付';
    case 'PAID_PENDING_PREP':
      return '待备货';
    case 'READY_FOR_PICKUP':
      return '待取货';
    case 'COMPLETED':
      return '已完成';
    case 'PAID_PENDING_SHIPMENT':
      return '待发货';
    case 'SHIPPED':
      return '已发货';
    case 'DELIVERED':
      return '已送达';
    case 'CANCELLED':
      return '已取消';
    case 'AFTER_SALES':
      return '售后中';
    default:
      return status;
  }
}

function getStatusTone(status: OrderStatus): { background: string; color: string; border: string } {
  if (status === 'PENDING_PAYMENT') {
    return { background: '#fef3c7', color: '#b45309', border: '#fde68a' };
  }

  if (status === 'CANCELLED' || status === 'AFTER_SALES') {
    return { background: '#f6f1e8', color: '#6b7280', border: '#e8e0d3' };
  }

  if (status === 'COMPLETED' || status === 'DELIVERED') {
    return { background: '#eaf6ee', color: '#236b45', border: '#d8ead9' };
  }

  return { background: '#eaf6ee', color: '#236b45', border: '#d8ead9' };
}

function getFulfillmentLabel(type: OrderDetail['fulfillmentType']): string {
  return type === 'STORE_PICKUP' ? '到店自提' : '邮寄发货';
}

function getOrderItemProductName(item: OrderItemSummary): string {
  return sanitizeProductDisplayName(item.sku?.product?.name?.trim() || '') || '商品信息同步中';
}

function getOrderItemSkuName(item: OrderItemSummary): string {
  return item.sku?.name?.trim() || '规格信息同步中';
}

function getOrderItemLineAmountCents(item: OrderItemSummary): number {
  return item.lineAmountCents ?? item.unitPriceCents * item.quantity;
}

function getOrderTail(orderNo: string): string {
  return orderNo.slice(-6);
}

function getReadableErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && /[\u4e00-\u9fa5]/.test(error.message)) {
    return error.message;
  }

  return fallback;
}

function shouldUseProtectedOrderDetailRead(): boolean {
  return getMiniappIdentitySource() === 'real-storage';
}

const POST_PAYMENT_STATUS_POLL_ATTEMPTS = 3;
const POST_PAYMENT_STATUS_POLL_INTERVAL_MS = 1500;
const POST_PAYMENT_PENDING_FALLBACK_MESSAGE = '已拉起微信支付，但暂未看到订单支付状态更新，请稍后重新进入或手动刷新订单详情。';
const AUTH_REDIRECT_ABORT_MESSAGE = 'AUTH_REDIRECT_ABORT';
const PAYMENT_TIMEOUT_MS = 30 * 60 * 1000;

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export default function OrderDetailPage() {
  const router = useRouter();
  const orderId = router.params?.orderId || '';

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [paymentNotice, setPaymentNotice] = useState('');
  const [paying, setPaying] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());

  async function refreshOrderDetail(currentOrderId: string, options?: { preserveFeedback?: boolean }) {
    const shouldPreserveFeedback = options?.preserveFeedback ?? false;

    setLoading(true);
    setError('');
    if (!shouldPreserveFeedback) {
      setFeedback('');
    }

    try {
      const usesProtectedOrderDetailRead = shouldUseProtectedOrderDetailRead();
      const storedAuthArtifact = getStoredCustomerAuthArtifact();

      if (usesProtectedOrderDetailRead && !storedAuthArtifact) {
        redirectToCustomerLogin(`/pages/order-detail/index?orderId=${currentOrderId}`);
        throw new Error(AUTH_REDIRECT_ABORT_MESSAGE);
      }

      const [orderData, storesData] = await Promise.all([
        usesProtectedOrderDetailRead ? getAuthenticatedOrder(currentOrderId) : getOrder(currentOrderId),
        getStores()
      ]);
      setOrder(orderData);
      setStores(storesData);
      return orderData;
    } catch (e) {
      if (e instanceof Error && e.message === AUTH_REDIRECT_ABORT_MESSAGE) {
        throw e;
      }

      setError(getReadableErrorMessage(e, '订单详情加载失败，请稍后重试。'));
      throw e;
    } finally {
      setLoading(false);
    }
  }

  async function refreshOrderDetailAfterPaymentLaunch(currentOrderId: string) {
    let latestOrder = await refreshOrderDetail(currentOrderId, { preserveFeedback: true });

    if (latestOrder.status !== 'PENDING_PAYMENT') {
      return latestOrder;
    }

    for (let attempt = 0; attempt < POST_PAYMENT_STATUS_POLL_ATTEMPTS; attempt += 1) {
      await sleep(POST_PAYMENT_STATUS_POLL_INTERVAL_MS);
      latestOrder = await refreshOrderDetail(currentOrderId, { preserveFeedback: true });

      if (latestOrder.status !== 'PENDING_PAYMENT') {
        return latestOrder;
      }
    }

    return latestOrder;
  }

  useEffect(() => {
    setPaymentNotice('');

    if (!orderId) {
      setLoading(false);
      return;
    }

    refreshOrderDetail(orderId).catch(() => undefined);
  }, [orderId]);

  const store = useMemo(
    () => stores.find((item) => item.id === order?.storeId) ?? null,
    [stores, order?.storeId]
  );

  const pageCopy = useMemo(() => {
    if (!orderId) return '请从订单列表重新进入订单详情。';
    if (loading) return '正在加载当前订单详情';
    if (error) return '订单详情加载失败，请重试。';
    return '查看订单状态、商品明细、价格明细和自提/配送信息。';
  }, [error, loading, orderId]);

  const canPay = order?.status === 'PENDING_PAYMENT';

  useEffect(() => {
    if (!canPay) return;

    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [canPay]);

  const statusTone = order ? getStatusTone(order.status) : null;
  const subtotalAmountCents = order?.subtotalAmountCents ?? order?.totalAmountCents ?? 0;
  const discountAmountCents = order?.discountAmountCents ?? 0;
  const memberDiscountAmountCents = order?.memberDiscountAmountCents ?? 0;
  const couponDiscountAmountCents = order?.couponDiscountAmountCents ?? Math.max(0, discountAmountCents - memberDiscountAmountCents);
  const usedCouponNames = order?.couponApplications
    ?.map((application) => application.couponNameSnapshot)
    .filter(Boolean)
    .join('、') || '';
  const appliedCouponCode = order?.appliedCouponCode?.trim() || '';
  const remainingPaymentMs = order && canPay
    ? Math.max(0, new Date(order.createdAt).getTime() + PAYMENT_TIMEOUT_MS - nowMs)
    : 0;
  const remainingPaymentMinutes = Math.floor(remainingPaymentMs / 60000);
  const remainingPaymentSeconds = Math.floor((remainingPaymentMs % 60000) / 1000);
  const remainingPaymentText = canPay
    ? `请在 ${String(remainingPaymentMinutes).padStart(2, '0')}:${String(remainingPaymentSeconds).padStart(2, '0')} 内完成支付`
    : '';

  async function handlePay() {
    if (!order) return;

    try {
      setPaying(true);
      setPaymentNotice('');
      setFeedback('正在处理支付，请稍候。');
      const result = await runCustomerPaymentTransition({
        orderId: order.id,
        paidAmountCents: order.totalAmountCents
      });

      if (!result.success) {
        setPaymentNotice(result.message);
        setFeedback('');
        return;
      }

      setFeedback(result.message);
      Taro.showToast({
        title: '已拉起支付',
        icon: 'success'
      });

      try {
        const refreshedOrder = await refreshOrderDetailAfterPaymentLaunch(order.id);

        if (refreshedOrder.status === 'PENDING_PAYMENT') {
          setFeedback(POST_PAYMENT_PENDING_FALLBACK_MESSAGE);
        }
      } catch {
        setFeedback(POST_PAYMENT_PENDING_FALLBACK_MESSAGE);
      }
    } catch (e) {
      setPaymentNotice(getReadableErrorMessage(e, '支付处理失败，请稍后重试。'));
      setFeedback('');
    } finally {
      setPaying(false);
    }
  }

  async function handleCancelOrder() {
    if (!order) return;

    const result = await Taro.showModal({
      title: '取消待支付订单',
      content: '取消后该订单将关闭，已锁定优惠券会释放回账户。',
      confirmText: '确认取消',
      cancelText: '先不取消'
    });

    if (!result.confirm) return;

    try {
      setCanceling(true);
      setPaymentNotice('');
      await cancelAuthenticatedOrder(order.id);
      setFeedback('订单已取消，优惠券已释放。');
      Taro.showToast({
        title: '订单已取消',
        icon: 'success'
      });
      await refreshOrderDetail(order.id, { preserveFeedback: true });
    } catch (e) {
      setPaymentNotice(getReadableErrorMessage(e, '取消订单失败，请稍后重试。'));
    } finally {
      setCanceling(false);
    }
  }

  async function addReorderItemsToCart(items: ReorderPreviewItem[]) {
    const cart = await getCart();

    if (cart.items.length > 0) {
      let action: { tapIndex: number };
      try {
        action = await Taro.showActionSheet({
          itemList: ['合并加入购物车', '清空购物车后加入']
        });
      } catch {
        return false;
      }

      if (action.tapIndex === 1) {
        await clearCartItems(cart.items.map((item) => item.id));
      }
    }

    for (const item of items) {
      await addCartItem(item.skuId, item.quantity);
    }

    return true;
  }

  async function handleReorder() {
    if (!order) return;

    if (!getStoredCustomerAuthArtifact()) {
      redirectToCustomerLogin(`/pages/order-detail/index?orderId=${order.id}`);
      return;
    }

    try {
      setReordering(true);
      const preview = await previewAuthenticatedReorder(order.id);

      if (preview.purchasableItems.length === 0) {
        await Taro.showModal({
          title: '暂不可再来一单',
          content: preview.message,
          showCancel: false,
          confirmText: '我知道了'
        });
        return;
      }

      if (preview.unavailableItems.length > 0) {
        const result = await Taro.showModal({
          title: '部分商品暂不可购买',
          content: '部分商品暂不可购买，已为你保留可购买商品。是否继续加入购物车？',
          confirmText: '继续加入',
          cancelText: '先不加入'
        });

        if (!result.confirm) return;
      }

      const added = await addReorderItemsToCart(preview.purchasableItems);
      if (!added) return;

      const result = await Taro.showModal({
        title: '已加入购物车',
        content: '已加入购物车，可继续选购或去结算。',
        confirmText: '去购物车',
        cancelText: '继续浏览'
      });

      if (result.confirm) {
        Taro.switchTab({ url: '/pages/cart/index' });
      }
    } catch (e) {
      setPaymentNotice(getReadableErrorMessage(e, '再来一单失败，请稍后重试。'));
    } finally {
      setReordering(false);
    }
  }

  if (!orderId) {
    return (
      <View className='page-fade-in' style={{ minHeight: '100vh', padding: '24rpx', background: '#fff8ea' }}>
        <View
          style={{
            background: '#ffffff',
            borderRadius: '24rpx',
            padding: '28rpx',
            textAlign: 'center'
          }}
        >
          <Text style={{ display: 'block', fontSize: '36rpx', fontWeight: '700', marginBottom: '12rpx' }}>订单详情</Text>
          <Text style={{ display: 'block', color: '#6b7280', marginBottom: '18rpx' }}>
            请从订单列表重新进入订单详情。
          </Text>
          <Button className='ui-pressable ui-primary-button' hoverClass='ui-pressable-hover' type='primary' onClick={() => Taro.navigateBack()}>
            返回订单列表
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View className='page-fade-in' style={{ minHeight: '100vh', padding: '28rpx', paddingBottom: canPay ? '170rpx' : '28rpx', background: '#fff8ea' }}>
      <View
        style={{
          background: '#ffffff',
          borderRadius: '24rpx',
          padding: '28rpx',
          marginBottom: '24rpx',
          boxShadow: '0 8rpx 24rpx rgba(23, 35, 28, 0.05)',
          border: '2rpx solid #e8e0d3'
        }}
      >
        <Text style={{ display: 'block', fontSize: '24rpx', color: '#236b45', fontWeight: '700', marginBottom: '10rpx' }}>
          绿膳荟干货海味店
        </Text>
        <Text style={{ display: 'block', fontSize: '40rpx', fontWeight: '800', marginBottom: '12rpx', color: '#17231c' }}>订单详情</Text>
        <Text style={{ display: 'block', fontSize: '26rpx', color: '#6b7280' }}>{pageCopy}</Text>
      </View>

      {feedback ? (
        <View
          style={{
            background: '#eaf6ee',
            borderRadius: '24rpx',
            padding: '24rpx',
            border: '2rpx solid #d8ead9',
            marginBottom: '24rpx'
          }}
        >
          <Text style={{ display: 'block', fontSize: '26rpx', color: '#236b45', fontWeight: '700' }}>{feedback}</Text>
        </View>
      ) : null}

      {paymentNotice ? (
        <View
          style={{
            background: '#fff4d8',
            borderRadius: '24rpx',
            padding: '24rpx',
            border: '2rpx solid #e8d4a8',
            marginBottom: '24rpx'
          }}
        >
          <Text style={{ display: 'block', fontSize: '28rpx', fontWeight: '700', color: '#6f4b16', marginBottom: '8rpx' }}>
            支付暂不可用
          </Text>
          <Text style={{ display: 'block', fontSize: '26rpx', color: '#17231c' }}>{paymentNotice}</Text>
        </View>
      ) : null}

      {loading ? (
        <View className='ui-skeleton-card'>
          <Text style={{ display: 'block', fontSize: '28rpx', fontWeight: '600', color: '#17231c', marginBottom: '20rpx' }}>
            正在加载订单详情…
          </Text>
          <View className='ui-skeleton-line' style={{ width: '60%', marginBottom: '18rpx' }} />
          <View className='ui-skeleton-block' style={{ height: '170rpx', marginBottom: '22rpx' }} />
          <View className='ui-skeleton-line' style={{ width: '88%', marginBottom: '16rpx' }} />
          <View className='ui-skeleton-pill' style={{ width: '210rpx' }} />
        </View>
      ) : error ? (
        <View
          style={{
            background: '#fdecec',
            borderRadius: '24rpx',
            padding: '28rpx',
            border: '2rpx solid #f6c7c7'
          }}
        >
          <Text style={{ display: 'block', fontSize: '30rpx', fontWeight: '600', marginBottom: '12rpx' }}>订单详情加载失败</Text>
          <Text style={{ display: 'block', fontSize: '26rpx', color: '#9f2a1d', marginBottom: '20rpx' }}>{error}</Text>
          <View style={{ display: 'flex', gap: '16rpx' }}>
            <Button
              className='ui-pressable ui-primary-button'
              hoverClass='ui-pressable-hover'
              size='mini'
              type='primary'
              onClick={() => {
                Taro.redirectTo({
                  url: `/pages/order-detail/index?orderId=${orderId}`
                });
              }}
            >
              重试
            </Button>
            <Button className='ui-pressable' hoverClass='ui-pressable-hover' size='mini' onClick={() => Taro.navigateBack()}>
              返回订单列表
            </Button>
          </View>
        </View>
      ) : !order ? (
        <View
          style={{
            background: '#ffffff',
            borderRadius: '24rpx',
            padding: '28rpx',
            textAlign: 'center',
            border: '2rpx solid #e8e0d3'
          }}
        >
          <Text style={{ display: 'block', fontSize: '30rpx', fontWeight: '600', marginBottom: '12rpx' }}>订单不存在</Text>
          <Text style={{ display: 'block', fontSize: '26rpx', color: '#6b7280', marginBottom: '20rpx' }}>
            当前无法加载这笔订单，请返回订单列表重新进入。
          </Text>
          <Button className='ui-pressable ui-primary-button' hoverClass='ui-pressable-hover' type='primary' onClick={() => Taro.navigateBack()}>
            返回订单列表
          </Button>
        </View>
      ) : (
        <View style={{ display: 'flex', flexDirection: 'column', gap: '24rpx' }}>
          <View className='brand-page-hero brand-order-detail-hero order-detail-readable-hero' style={{ border: canPay ? '2rpx solid #f1c87a' : '2rpx solid #e8e0d3' }}>
            <Image className='brand-page-hero-bg' src={homeHeroImage} mode='aspectFill' />
            <View className='brand-page-hero-shade' />
            <View className='brand-page-hero-copy'>
              <Text className='brand-page-hero-kicker'>订单详情</Text>
              <Text className='brand-page-hero-title'>{getStatusLabel(order.status)}</Text>
              <Text className='brand-page-hero-subtitle'>订单信息已为你整理，请核对后继续处理。</Text>
            </View>
            <View className='order-detail-hero-info-panel'>
              <View className='order-detail-hero-head'>
                <View style={{ flex: 1 }}>
                  <Text className='order-detail-tail'>
                  订单尾号 {getOrderTail(order.orderNo)}
                </Text>
                  <Text className='order-detail-status-title'>
                  {getStatusLabel(order.status)}
                </Text>
                  <Text className='order-detail-time'>
                  下单时间：{formatDateTime(order.createdAt)}
                </Text>
              </View>
                <View
                  className='order-status-badge-readable'
                  style={{
                    background: statusTone?.background || '#eaf6ee',
                    border: `2rpx solid ${statusTone?.border || '#d8ead9'}`
                  }}
                >
                  <Text style={{ color: statusTone?.color || '#236b45' }}>{getStatusLabel(order.status)}</Text>
                </View>
              </View>

              <View className='readable-info-list'>
                <View className='readable-info-row'>
                  <Text className='readable-info-label'>取货方式</Text>
                  <Text className='readable-info-value'>{getFulfillmentLabel(order.fulfillmentType)}</Text>
              </View>
                <View className='readable-info-row'>
                  <Text className='readable-info-label'>门店</Text>
                  <Text className='readable-info-value readable-info-value-wrap'>
                    {store?.name || '服务门店同步中'}
                  </Text>
              </View>
            </View>

              <View className='order-detail-amount-pill'>
                <Text>订单金额</Text>
                <Text>{formatPriceCents(order.totalAmountCents)}</Text>
              </View>

            {canPay ? (
                <Text className='order-detail-pay-note'>
                当前订单待支付，请确认金额后完成支付。
              </Text>
            ) : null}
            {canPay ? (
              <Text className='order-detail-pay-note' style={{ marginTop: '8rpx', color: remainingPaymentMs > 0 ? '#6f4b16' : '#9f2a1d' }}>
                {remainingPaymentMs > 0 ? remainingPaymentText : '订单可能已超时，请刷新后查看最新状态。'}
              </Text>
            ) : null}
            {order.status === 'CANCELLED' && (order.couponApplications?.length || 0) > 0 ? (
              <Text className='order-detail-pay-note' style={{ marginTop: '8rpx', color: '#236b45' }}>
                订单已关闭，已锁定优惠券会释放回账户。
              </Text>
            ) : null}
            </View>
          </View>

          <View
            style={{
              background: '#ffffff',
              borderRadius: '24rpx',
              padding: '28rpx',
              boxShadow: '0 8rpx 24rpx rgba(23, 35, 28, 0.05)',
              border: '2rpx solid #e8e0d3'
            }}
          >
            <Text className='readable-section-title'>价格明细</Text>
            <View className='readable-info-list'>
              <View className='readable-info-row'>
                <Text className='readable-info-label'>商品金额</Text>
                <Text className='readable-info-value'>{formatPriceCents(subtotalAmountCents)}</Text>
              </View>
              <View className='readable-info-row'>
                <Text className='readable-info-label'>会员优惠</Text>
                <Text className='readable-info-value readable-info-value-green'>-{formatPriceCents(memberDiscountAmountCents)}</Text>
              </View>
              <View className='readable-info-row'>
                <Text className='readable-info-label'>优惠券优惠</Text>
                <Text className='readable-info-value readable-info-value-green'>-{formatPriceCents(couponDiscountAmountCents)}</Text>
              </View>
              <View className='readable-info-row'>
                <Text className='readable-info-label'>已用优惠券</Text>
                <Text className='readable-info-value readable-info-value-wrap'>{usedCouponNames || appliedCouponCode || '未使用优惠券'}</Text>
              </View>
              <View className='readable-info-row readable-total-row'>
                <Text className='readable-info-label readable-total-label'>应付金额</Text>
                <Text className='readable-info-value readable-total-amount'>{formatPriceCents(order.totalAmountCents)}</Text>
              </View>
            </View>
          </View>

          <View
            style={{
              background: '#ffffff',
              borderRadius: '24rpx',
              padding: '28rpx',
              boxShadow: '0 8rpx 24rpx rgba(23, 35, 28, 0.05)',
              border: '2rpx solid #e8e0d3'
            }}
          >
            <Text className='readable-section-title'>商品明细</Text>
            <View style={{ display: 'flex', flexDirection: 'column', gap: '18rpx' }}>
              {order.items.map((item) => (
                <View
                  key={item.id}
                  style={{
                    padding: '22rpx',
                    borderRadius: '18rpx',
                    background: '#fffdfa',
                    border: '2rpx solid #e8e0d3'
	                  }}
	                >
	                  <View style={{ display: 'flex', gap: '18rpx', alignItems: 'center', marginBottom: '16rpx' }}>
		                    <View className='order-detail-item-thumb' style={{ width: '118rpx', height: '118rpx', borderRadius: '18rpx' }}>
		                      <Image className='order-detail-item-thumb-image' src={serviceSoupImage} mode='aspectFill' />
		                      <View className='brand-art-thumb-badge'>
		                        <Text>严选</Text>
		                      </View>
	                    </View>
	                    <View style={{ flex: 1 }}>
	                      <Text style={{ display: 'block', fontSize: '28rpx', fontWeight: '700', marginBottom: '8rpx', color: '#17231c' }}>
	                        {getOrderItemProductName(item)}
	                      </Text>
	                      <Text style={{ display: 'block', fontSize: '23rpx', color: '#6b7280' }}>
	                        规格：{getOrderItemSkuName(item)}
	                      </Text>
	                    </View>
	                  </View>
                  <View className='readable-info-row readable-compact-row'>
                    <Text className='readable-info-label'>数量</Text>
                    <Text className='readable-info-value'>{item.quantity}</Text>
                  </View>
                  <View className='readable-info-row readable-compact-row'>
                    <Text className='readable-info-label'>单价</Text>
                    <Text className='readable-info-value'>{formatPriceCents(item.unitPriceCents)}</Text>
                  </View>
                  <View className='readable-info-row readable-compact-row readable-total-row'>
                    <Text className='readable-info-label readable-total-label'>小计</Text>
                    <Text className='readable-info-value readable-info-value-amount'>{formatPriceCents(getOrderItemLineAmountCents(item))}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {order.fulfillmentType === 'SHIPPING' ? (
            <View
              style={{
                background: '#ffffff',
                borderRadius: '24rpx',
                padding: '28rpx',
                boxShadow: '0 8rpx 24rpx rgba(23, 35, 28, 0.05)',
                border: '2rpx solid #e8e0d3'
              }}
            >
              <Text className='readable-section-title'>发货信息</Text>
              <View className='readable-info-list'>
                <View className='readable-info-row'>
                  <Text className='readable-info-label'>收货人</Text>
                  <Text className='readable-info-value readable-info-value-wrap'>
                    {order.shippingAddress
                      ? `${order.shippingAddress.receiverName}，${order.shippingAddress.phone}`
                      : '暂未生成'}
                  </Text>
                </View>
                <View className='readable-info-row'>
                  <Text className='readable-info-label'>地址详情</Text>
                  <Text className='readable-info-value readable-info-value-wrap'>
                    {order.shippingAddress
                      ? `${order.shippingAddress.province} ${order.shippingAddress.city} ${order.shippingAddress.district} ${order.shippingAddress.detail}`
                      : '暂未生成'}
                  </Text>
                </View>
                <View className='readable-info-row'>
                  <Text className='readable-info-label'>快递公司</Text>
                  <Text className='readable-info-value'>{order.shipment?.courierCompany || '暂未发货'}</Text>
                </View>
                <View className='readable-info-row'>
                  <Text className='readable-info-label'>运单号</Text>
                  <Text className='readable-info-value'>{order.shipment?.trackingNumber || '暂未生成'}</Text>
                </View>
                <View className='readable-info-row'>
                  <Text className='readable-info-label'>发货时间</Text>
                  <Text className='readable-info-value'>{formatDateTime(order.shipment?.shippedAt)}</Text>
                </View>
                <View className='readable-info-row'>
                  <Text className='readable-info-label'>送达时间</Text>
                  <Text className='readable-info-value'>{formatDateTime(order.shipment?.deliveredAt)}</Text>
                </View>
              </View>
            </View>
          ) : (
            <View
              style={{
                background: '#ffffff',
                borderRadius: '24rpx',
                padding: '28rpx',
                boxShadow: '0 8rpx 24rpx rgba(23, 35, 28, 0.05)',
                border: '2rpx solid #e8e0d3'
              }}
            >
	              <View style={{ display: 'flex', alignItems: 'center', gap: '14rpx', marginBottom: '18rpx' }}>
	                <Image className='brand-section-icon' src={serviceStoreImage} mode='aspectFill' />
	                <Text style={{ display: 'block', fontSize: '30rpx', fontWeight: '800', color: '#17231c' }}>自提信息</Text>
	              </View>
              <View className='readable-info-list'>
                <View className='readable-info-row'>
                  <Text className='readable-info-label'>门店名称</Text>
                  <Text className='readable-info-value readable-info-value-wrap'>{store?.name || '服务门店同步中'}</Text>
                </View>
                <View className='readable-info-row'>
                  <Text className='readable-info-label'>门店地址</Text>
                  <Text className='readable-info-value readable-info-value-wrap'>{store?.address || '暂未同步门店地址'}</Text>
                </View>
                <View className='readable-info-row'>
                  <Text className='readable-info-label'>提货码</Text>
                  <Text className='readable-info-value pickup-code-value'>{order.pickupRecord?.pickupCode || '订单创建后可见'}</Text>
                </View>
                <View className='readable-info-row'>
                  <Text className='readable-info-label'>提货时段</Text>
                  <Text className='readable-info-value'>{order.pickupTimeSlot || '暂未设置'}</Text>
                </View>
                <View className='readable-info-row'>
                  <Text className='readable-info-label'>提货日期</Text>
                  <Text className='readable-info-value'>{formatDateTime(order.pickupDate)}</Text>
                </View>
                <View className='readable-info-row'>
                  <Text className='readable-info-label'>完成取货时间</Text>
                  <Text className='readable-info-value'>{formatDateTime(order.pickupRecord?.pickedUpAt)}</Text>
                </View>
              </View>
            </View>
          )}

          <View style={{ display: 'flex', gap: '16rpx' }}>
            <Button className='ui-pressable' hoverClass='ui-pressable-hover' disabled={paying || reordering} onClick={() => Taro.navigateBack()}>
              返回订单列表
            </Button>
            {order.status === 'CANCELLED' || order.status === 'COMPLETED' || order.status === 'DELIVERED' ? (
              <Button
                className='ui-pressable ui-secondary-button'
                hoverClass='ui-pressable-hover'
                disabled={paying || canceling || reordering}
                loading={reordering}
                onClick={handleReorder}
              >
                {reordering ? '加入中' : '再来一单'}
              </Button>
            ) : null}
          </View>
        </View>
      )}

      {order && canPay ? (
        <View
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            padding: '18rpx 28rpx 28rpx',
            background: '#ffffff',
            borderTop: '2rpx solid #e8e0d3',
            boxShadow: '0 -10rpx 24rpx rgba(23, 35, 28, 0.08)'
          }}
        >
          <View style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '18rpx', marginBottom: '16rpx' }}>
            <View>
              <Text style={{ display: 'block', fontSize: '22rpx', color: '#6b7280' }}>待支付金额</Text>
              <Text style={{ display: 'block', fontSize: '36rpx', fontWeight: '800', color: '#d94836' }}>
                {formatPriceCents(order.totalAmountCents)}
              </Text>
            </View>
            <Text style={{ fontSize: '22rpx', color: '#6b7280', textAlign: 'right' }}>
              {remainingPaymentMs > 0 ? remainingPaymentText : '请刷新订单状态'}
            </Text>
          </View>
          <View style={{ display: 'flex', gap: '14rpx' }}>
            <Button
              className='ui-pressable'
              hoverClass='ui-pressable-hover'
              disabled={paying || canceling || reordering}
              loading={canceling}
              onClick={handleCancelOrder}
              style={{ flex: 1 }}
            >
              {canceling ? '取消中' : '取消订单'}
            </Button>
            <Button
              className='ui-pressable ui-primary-button'
              hoverClass='ui-pressable-hover'
              type='primary'
              disabled={paying || canceling || reordering}
              loading={paying}
              onClick={handlePay}
              style={{ flex: 1 }}
            >
              {paying ? '处理中' : '立即支付'}
            </Button>
          </View>
        </View>
      ) : null}
    </View>
  );
}
