import { useMemo, useState } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { Button, Image, Text, View } from '@tarojs/components';

import emptyOrderImage from '../../assets/brand/empty-order.jpg';
import homeHeroImage from '../../assets/brand/home-hero.jpg';
import serviceSoupImage from '../../assets/brand/service-soup.jpg';
import {
  addCartItem,
  cancelAuthenticatedOrder,
  clearCartItems,
  getAuthenticatedOrders,
  getCart,
  getOrders,
  previewAuthenticatedReorder,
  type OrderStatus,
  type OrderSummary,
  type OrderItemSummary,
  type ReorderPreviewItem
} from '../../lib/api';
import { redirectToCustomerLogin } from '../../lib/customer-login-redirect';
import { sanitizeProductDisplayName } from '../../lib/product-display-name';
import { getMiniappIdentitySource } from '../../lib/identity';
import { getStoredCustomerAuthArtifact } from '../../lib/identity-storage';

function formatPriceCents(amountCents: number): string {
  const value = (Number(amountCents) || 0) / 100;
  return `¥${value.toFixed(2)}`;
}

function formatDateTime(value: string): string {
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

function getFulfillmentLabel(type: OrderSummary['fulfillmentType']): string {
  return type === 'STORE_PICKUP' ? '到店自提' : '邮寄发货';
}

function getOrderItemProductName(item?: OrderItemSummary): string {
  return sanitizeProductDisplayName(item?.sku?.product?.name?.trim() || '') || '商品信息同步中';
}

function getOrderItemSkuName(item?: OrderItemSummary): string {
  return item?.sku?.name?.trim() || '规格信息同步中';
}

function getOrderProductSummary(order: OrderSummary): string {
  const [firstItem] = order.items;
  if (!firstItem) return '商品信息同步中';

  const totalCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const baseSummary = `${getOrderItemProductName(firstItem)} · ${getOrderItemSkuName(firstItem)}`;

  if (order.items.length === 1) {
    return baseSummary;
  }

  return `${baseSummary} 等 ${totalCount} 件`;
}

function getOrderItemsSummary(order: OrderSummary): string {
  const totalCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  return `${totalCount} 件商品`;
}

function getOrderAmountSummary(order: OrderSummary): string {
  if (order.status === 'PENDING_PAYMENT') {
    return `待支付 ${formatPriceCents(order.totalAmountCents)}`;
  }

  return `${getStatusLabel(order.status)} ${formatPriceCents(order.totalAmountCents)}`;
}

function getOrderStatusHint(order: OrderSummary): string {
  switch (order.status) {
    case 'PENDING_PAYMENT':
      return '请在剩余时间内完成支付';
    case 'CANCELLED':
      return order.couponApplications?.length ? '订单已关闭，优惠券已释放' : '订单已关闭';
    case 'PAID_PENDING_PREP':
    case 'READY_FOR_PICKUP':
    case 'PAID_PENDING_SHIPMENT':
      return '门店正在处理订单';
    case 'SHIPPED':
      return '商品已发出，请留意物流';
    case 'COMPLETED':
    case 'DELIVERED':
      return '订单已完成，可再来一单';
    default:
      return '';
  }
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

function shouldUseProtectedOrdersPageRead(): boolean {
  return getMiniappIdentitySource() === 'real-storage';
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);
  const [operatingOrderId, setOperatingOrderId] = useState('');

  async function loadOrders() {
    setError('');
    setNeedsLogin(false);

    const storedAuthArtifact = getStoredCustomerAuthArtifact();

    if (!storedAuthArtifact) {
      setOrders([]);
      setLoading(false);
      setNeedsLogin(true);
      return;
    }

    setLoading(true);

    try {
      const usesProtectedOrderRead = shouldUseProtectedOrdersPageRead();
      const data = usesProtectedOrderRead
        ? await getAuthenticatedOrders()
        : await getOrders();
      setOrders(data);
    } catch (e) {
      setError(getReadableErrorMessage(e, '订单列表加载失败，请稍后重试。'));
    } finally {
      setLoading(false);
    }
  }

  useDidShow(() => {
    loadOrders();
  });

  async function handleCancelOrder(order: OrderSummary) {
    const result = await Taro.showModal({
      title: '取消待支付订单',
      content: '取消后该订单将关闭，已锁定优惠券会释放回账户。',
      confirmText: '确认取消',
      cancelText: '先不取消'
    });

    if (!result.confirm) return;

    try {
      setOperatingOrderId(order.id);
      await cancelAuthenticatedOrder(order.id);
      Taro.showToast({
        title: '订单已取消',
        icon: 'success'
      });
      await loadOrders();
    } catch (e) {
      Taro.showToast({
        title: getReadableErrorMessage(e, '取消订单失败，请稍后重试。'),
        icon: 'none'
      });
    } finally {
      setOperatingOrderId('');
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

  async function handleReorder(order: OrderSummary) {
    if (!getStoredCustomerAuthArtifact()) {
      redirectToCustomerLogin('/pages/orders/index');
      return;
    }

    try {
      setOperatingOrderId(order.id);
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
      Taro.showToast({
        title: getReadableErrorMessage(e, '再来一单失败，请稍后重试。'),
        icon: 'none'
      });
    } finally {
      setOperatingOrderId('');
    }
  }

  const pageCopy = useMemo(() => {
    if (loading) return '正在加载你的订单';
    if (needsLogin) return '登录后可以查看订单进度。';
    if (error) return '订单列表加载失败，请重试。';
    return '查看待支付、备货、自提和发货进度。';
  }, [error, loading, needsLogin]);

  const statusEntries = useMemo(() => {
    const pendingCount = orders.filter((order) => order.status === 'PENDING_PAYMENT').length;
    const preparingCount = orders.filter((order) => order.status === 'PAID_PENDING_PREP' || order.status === 'PAID_PENDING_SHIPMENT').length;
    const completedCount = orders.filter((order) => order.status === 'COMPLETED' || order.status === 'DELIVERED').length;

    return [
      { label: '全部订单', count: orders.length },
      { label: '待支付', count: pendingCount },
      { label: '备货中', count: preparingCount },
      { label: '已完成', count: completedCount }
    ];
  }, [orders]);

  return (
    <View className='page-fade-in' style={{ minHeight: '100vh', padding: '28rpx', background: '#fff8ea' }}>
      <View className='brand-page-hero brand-orders-hero' style={{ marginBottom: '18rpx' }}>
        <Image className='brand-page-hero-bg' src={homeHeroImage} mode='aspectFill' />
        <View className='brand-page-hero-shade' />
        <View className='brand-page-hero-copy'>
          <Text className='brand-page-hero-kicker'>绿膳荟干货海味店</Text>
          <Text className='brand-page-hero-title'>我的订单</Text>
          <Text className='brand-page-hero-subtitle'>{pageCopy}</Text>
        </View>
      </View>

      <View className='order-status-row' style={{ marginBottom: '24rpx' }}>
        {statusEntries.map((entry) => (
          <View className='order-status-entry' key={entry.label}>
            <Text>{entry.label}</Text>
            <Text>{entry.count}</Text>
          </View>
        ))}
      </View>

      {loading ? (
        <View className='ui-skeleton-card'>
          <Text style={{ display: 'block', fontSize: '28rpx', fontWeight: '600', color: '#17231c', marginBottom: '20rpx' }}>
            正在加载订单…
          </Text>
          <View className='ui-skeleton-line' style={{ width: '58%', marginBottom: '18rpx' }} />
          <View className='ui-skeleton-block' style={{ height: '160rpx', marginBottom: '22rpx' }} />
          <View className='ui-skeleton-line' style={{ width: '86%', marginBottom: '16rpx' }} />
          <View className='ui-skeleton-pill' style={{ width: '180rpx' }} />
        </View>
      ) : needsLogin ? (
        <View className='brand-empty-card'>
          <Image className='brand-empty-image' src={emptyOrderImage} mode='aspectFill' />
          <Text style={{ display: 'block', fontSize: '30rpx', fontWeight: '700', color: '#17231c', marginBottom: '12rpx' }}>请先登录后查看订单</Text>
          <Text style={{ display: 'block', fontSize: '26rpx', color: '#6b7280', marginBottom: '28rpx' }}>
            登录后可以查看待支付、备货、自提和发货进度。
          </Text>
          <View style={{ display: 'flex', gap: '22rpx', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              className='ui-pressable ui-primary-button'
              hoverClass='ui-pressable-hover'
              size='mini'
              type='primary'
              style={{ minWidth: '150rpx' }}
              onClick={() => redirectToCustomerLogin('/pages/orders/index')}
            >
              微信登录
            </Button>
            <Button
              className='ui-pressable ui-secondary-button'
              hoverClass='ui-pressable-hover'
              size='mini'
              plain
              style={{ minWidth: '150rpx', borderColor: '#e8e0d3', color: '#6b7280', background: '#fffdfa' }}
              onClick={() => {
                Taro.switchTab({ url: '/pages/products/index' });
              }}
            >
              先去逛商品
            </Button>
          </View>
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
          <Text style={{ display: 'block', fontSize: '30rpx', fontWeight: '600', marginBottom: '12rpx' }}>订单列表加载失败</Text>
          <Text style={{ display: 'block', fontSize: '26rpx', color: '#9f2a1d', marginBottom: '20rpx' }}>{error}</Text>
          <View style={{ display: 'flex', gap: '16rpx' }}>
            <Button className='ui-pressable ui-primary-button' hoverClass='ui-pressable-hover' size='mini' type='primary' onClick={loadOrders}>
              重试
            </Button>
            <Button className='ui-pressable' hoverClass='ui-pressable-hover' size='mini' onClick={() => Taro.navigateBack()}>
              返回上一页
            </Button>
          </View>
        </View>
      ) : orders.length === 0 ? (
        <View className='brand-empty-card'>
          <Image className='brand-empty-image' src={emptyOrderImage} mode='aspectFill' />
          <Text style={{ display: 'block', fontSize: '30rpx', fontWeight: '700', color: '#17231c', marginBottom: '12rpx' }}>暂时还没有订单</Text>
          <Text style={{ display: 'block', fontSize: '26rpx', color: '#6b7280', marginBottom: '28rpx' }}>
            可以先去商品列表挑选商品，下单后会在这里查看进度。
          </Text>
          <View style={{ display: 'flex', gap: '22rpx', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              className='ui-pressable ui-primary-button'
              hoverClass='ui-pressable-hover'
              size='mini'
              type='primary'
              style={{ minWidth: '150rpx' }}
              onClick={() => {
                Taro.switchTab({
                  url: '/pages/products/index'
                });
              }}
            >
              去逛商品
            </Button>
            <Button
              className='ui-pressable ui-secondary-button'
              hoverClass='ui-pressable-hover'
              size='mini'
              plain
              style={{ minWidth: '150rpx', borderColor: '#e8e0d3', color: '#6b7280', background: '#fffdfa' }}
              onClick={loadOrders}
            >
              刷新列表
            </Button>
          </View>
        </View>
      ) : (
        <View style={{ display: 'flex', flexDirection: 'column', gap: '20rpx' }}>
          <View style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: '26rpx', color: '#6b7280' }}>共 {orders.length} 笔订单</Text>
            <Button className='ui-pressable' hoverClass='ui-pressable-hover' size='mini' onClick={loadOrders}>
              刷新列表
            </Button>
          </View>

          {orders.map((order) => (
            <View
              key={order.id}
              className='ui-card-pressable order-card-shell'
              hoverClass='ui-card-pressable-hover'
              style={{
                background: '#ffffff',
                borderRadius: '24rpx',
                padding: '28rpx',
                boxShadow: '0 10rpx 26rpx rgba(23, 35, 28, 0.06)',
                border: order.status === 'PENDING_PAYMENT' ? '2rpx solid #f1c87a' : '2rpx solid #e8e0d3'
              }}
            >
              <View className='order-card-accent' />
              <View className='order-card-seal'>
                <Text>荟</Text>
              </View>
              <View style={{ display: 'flex', justifyContent: 'space-between', gap: '16rpx', marginBottom: '16rpx' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ display: 'block', fontSize: '30rpx', fontWeight: '800', marginBottom: '8rpx', color: '#17231c' }}>
                    订单尾号 {getOrderTail(order.orderNo)}
                  </Text>
                  <Text style={{ display: 'block', fontSize: '24rpx', color: '#6b7280' }}>
                    {formatDateTime(order.createdAt)}
                  </Text>
                </View>
                {(() => {
                  const tone = getStatusTone(order.status);

                  return (
                <View
                  style={{
                    padding: '8rpx 16rpx',
                    borderRadius: '999rpx',
                    background: tone.background,
                    border: `2rpx solid ${tone.border}`,
                    alignSelf: 'flex-start'
                  }}
                >
                  <Text style={{ fontSize: '22rpx', color: tone.color, fontWeight: '700' }}>{getStatusLabel(order.status)}</Text>
                </View>
                  );
                })()}
              </View>

              <View className='order-card-main'>
                <Image className='order-card-thumb' src={serviceSoupImage} mode='aspectFill' />
                <View className='order-card-summary'>
                  <Text style={{ display: 'block', fontSize: '28rpx', fontWeight: '800', color: '#17231c', marginBottom: '10rpx', lineHeight: '1.35' }}>
                    {getOrderProductSummary(order)}
                  </Text>
                  <View className='order-card-chips'>
                    <Text className='order-card-chip'>{getFulfillmentLabel(order.fulfillmentType)}</Text>
                    <Text className='order-card-chip'>{getOrderItemsSummary(order)}</Text>
                  </View>
                  <Text className='order-card-amount-summary'>{getOrderAmountSummary(order)}</Text>
                  {getOrderStatusHint(order) ? (
                    <Text className='order-card-status-hint'>{getOrderStatusHint(order)}</Text>
                  ) : null}
                  <Text className='order-card-service-note'>绿膳荟门店服务</Text>
                </View>
              </View>

              <View style={{ display: 'flex', gap: '12rpx', flexWrap: 'wrap' }}>
                {order.isFreshPreorder ? (
                  // Phase 2.48J：鲜鱼预订单 —— 不显示“去支付”，标注待门店确认（线下称重结算）。
                  <View style={{ padding: '8rpx 18rpx', borderRadius: '999rpx', background: '#e7f5f2', border: '2rpx solid #bfdcd6' }}>
                    <Text style={{ fontSize: '22rpx', color: '#2e7568', fontWeight: '700' }}>鲜鱼预订 · 待门店确认（线下称重结算，不在线支付）</Text>
                  </View>
                ) : order.status === 'PENDING_PAYMENT' ? (
                  <>
                    <Button
                      className='ui-pressable ui-primary-button'
                      hoverClass='ui-pressable-hover'
                      size='mini'
                      type='primary'
                      onClick={() => {
                        Taro.navigateTo({
                          url: `/pages/order-detail/index?orderId=${order.id}`
                        });
                      }}
                    >
                      去支付
                    </Button>
                    <Button
                      className='ui-pressable'
                      hoverClass='ui-pressable-hover'
                      size='mini'
                      loading={operatingOrderId === order.id}
                      disabled={Boolean(operatingOrderId)}
                      onClick={() => handleCancelOrder(order)}
                    >
                      取消订单
                    </Button>
                  </>
                ) : null}
                <Button
                  className='ui-pressable'
                  hoverClass='ui-pressable-hover'
                  size='mini'
                  onClick={() => {
                    Taro.navigateTo({
                      url: `/pages/order-detail/index?orderId=${order.id}`
                    });
                  }}
                >
                  查看详情
                </Button>
                {order.status === 'CANCELLED' || order.status === 'COMPLETED' || order.status === 'DELIVERED' ? (
                  <Button
                    className='ui-pressable'
                    hoverClass='ui-pressable-hover'
                    size='mini'
                    loading={operatingOrderId === order.id}
                    disabled={Boolean(operatingOrderId)}
                    onClick={() => handleReorder(order)}
                  >
                    再来一单
                  </Button>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
