import { useEffect, useRef, useState } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { Button, Image, Text, View } from '@tarojs/components';

import emptyOrderImage from '../../assets/brand/empty-order.jpg';
import { getFreshProductCover, getProductCover } from '../../lib/product-artwork';
import { sanitizeProductDisplayName } from '../../lib/product-display-name';
import {
  clearCartItems,
  getCart,
  removeCartItem,
  updateCartItemQuantity,
  type CartItemSummary,
  type CartSummary
} from '../../lib/api';
import { redirectToCustomerLogin } from '../../lib/customer-login-redirect';
import { getMiniappIdentitySource } from '../../lib/identity';
import { getStoredCustomerAuthArtifact } from '../../lib/identity-storage';

function formatPriceCents(amountCents: number): string {
  const value = (Number(amountCents) || 0) / 100;
  return `¥${value.toFixed(2)}`;
}


function getReadableErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && /[\u4e00-\u9fa5]/.test(error.message)) {
    return error.message;
  }

  return fallback;
}

function isCartAuthError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return /401|Unauthorized|Bearer|auth artifact|登录|授权/i.test(message);
}

function getCartLoadErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || '');

  if (/request:fail|timeout|connect|connection|ECONNREFUSED|network|Failed to fetch/i.test(message)) {
    return '购物车服务暂时连接不上，请稍后重试。';
  }

  return '购物车数据暂时不可用，请稍后重试。';
}

function isLoggedIn(): boolean {
  return getMiniappIdentitySource() === 'real-storage' && Boolean(getStoredCustomerAuthArtifact());
}

function getLineAmountCents(item: CartItemSummary): number {
  return typeof item.lineAmountCents === 'number' ? item.lineAmountCents : item.unitPriceCents * item.quantity;
}

function getCartItemCount(cart: CartSummary | null): number {
  if (!cart) return 0;
  return typeof cart.itemCount === 'number'
    ? cart.itemCount
    : cart.items.reduce((sum, item) => sum + item.quantity, 0);
}

function getCartSubtotalAmountCents(cart: CartSummary | null): number {
  if (!cart) return 0;
  return typeof cart.subtotalAmountCents === 'number'
    ? cart.subtotalAmountCents
    : cart.items.reduce((sum, item) => sum + getLineAmountCents(item), 0);
}

export default function CartPage() {
  const [cart, setCart] = useState<CartSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actingItemId, setActingItemId] = useState('');
  const [error, setError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);
  const hasLoadedOnceRef = useRef(false);
  const loadRequestIdRef = useRef(0);

  async function loadCart(options: { silent?: boolean } = {}) {
    const requestId = ++loadRequestIdRef.current;

    if (!isLoggedIn()) {
      setNeedsLogin(true);
      setLoading(false);
      setCart(null);
      return;
    }

    if (!options.silent) {
      setLoading(true);
    }
    setError('');
    setNeedsLogin(false);

    try {
      const data = await getCart();
      if (requestId !== loadRequestIdRef.current) return;
      console.warn('购物车加载成功', {
        itemCount: getCartItemCount(data),
        subtotalAmountCents: getCartSubtotalAmountCents(data)
      });
      setCart(data);
    } catch (e) {
      if (requestId !== loadRequestIdRef.current) return;
      console.warn('购物车加载失败', e);
      if (isCartAuthError(e)) {
        setNeedsLogin(true);
        setCart(null);
      } else {
        setError(getCartLoadErrorMessage(e));
      }
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    hasLoadedOnceRef.current = true;
    loadCart();
  }, []);

  useDidShow(() => {
    if (!hasLoadedOnceRef.current) return;
    loadCart({ silent: Boolean(cart) });
  });

  async function updateQuantity(item: CartItemSummary, nextQuantity: number) {
    if (nextQuantity < 1) return;

    setActingItemId(item.id);
    setError('');

    try {
      const data = await updateCartItemQuantity(item.id, nextQuantity);
      console.warn('购物车数量更新成功', {
        itemCount: getCartItemCount(data),
        subtotalAmountCents: getCartSubtotalAmountCents(data)
      });
      setCart(data);
    } catch (e) {
      Taro.showToast({
        title: getReadableErrorMessage(e, '数量更新失败'),
        icon: 'none'
      });
    } finally {
      setActingItemId('');
    }
  }

  async function removeItem(item: CartItemSummary) {
    const confirmation = await Taro.showModal({
      title: '移除商品',
      content: '确定要从购物车移除这件商品吗？',
      confirmText: '移除',
      cancelText: '取消'
    });

    if (!confirmation.confirm) return;

    setActingItemId(item.id);
    setError('');

    try {
      const data = await removeCartItem(item.id);
      console.warn('购物车商品移除成功', {
        itemCount: getCartItemCount(data),
        subtotalAmountCents: getCartSubtotalAmountCents(data)
      });
      setCart(data);
    } catch (e) {
      Taro.showToast({
        title: getReadableErrorMessage(e, '移除失败'),
        icon: 'none'
      });
    } finally {
      setActingItemId('');
    }
  }

  // Phase 2.51D：清空购物车（复用 clear-items API，一次删除全部 item）。
  async function clearCart() {
    const itemIds = cart?.items.map((item) => item.id) || [];
    if (itemIds.length === 0) return;
    const confirmation = await Taro.showModal({
      title: '清空购物车',
      content: '确定清空购物车吗？此操作会移除全部商品。',
      confirmText: '清空',
      cancelText: '取消'
    });
    if (!confirmation.confirm) return;
    setActingItemId('__clear__');
    setError('');
    try {
      const data = await clearCartItems(itemIds);
      setCart(data);
      Taro.showToast({ title: '购物车已清空', icon: 'success' });
    } catch (e) {
      Taro.showToast({ title: getReadableErrorMessage(e, '清空失败'), icon: 'none' });
    } finally {
      setActingItemId('');
    }
  }

  function goCheckout() {
    const itemIds = cart?.items.map((item) => item.id) || [];

    if (itemIds.length === 0) {
      Taro.showToast({ title: '请先选择商品', icon: 'none' });
      return;
    }

    if ((cart?.availableStores.length || 0) === 0) {
      Taro.showToast({ title: '当前购物车商品暂无共同可服务门店', icon: 'none' });
      return;
    }

    Taro.navigateTo({
      url: `/pages/checkout/index?cartItemIds=${itemIds.join(',')}`
    });
  }

  const cartItems = cart?.items || [];
  const hasItems = cartItems.length > 0;
  const cartItemCount = getCartItemCount(cart);
  const cartSubtotalAmountCents = getCartSubtotalAmountCents(cart);
  // Phase 2.51B：鲜鱼改为直购——鲜鱼车与普通车一样走「去结算」(goCheckout) 普通订单/支付，不再走 createFreshPreorder。
  // 旧 createFreshPreorder API 客户端函数保留在 lib/api，不再从购物车调用（鲜鱼已直购）。

  return (
    <View className='page-fade-in cart-page' style={{ minHeight: '100vh', padding: '28rpx', paddingBottom: hasItems ? '180rpx' : '28rpx', background: '#fff8ea' }}>
      <View className='cart-hero-card'>
        <Text className='cart-hero-kicker'>绿膳荟干货海味店</Text>
        <Text className='cart-hero-title'>购物车</Text>
        <Text className='cart-hero-subtitle'>已选商品会在这里汇总，结算前仍会再次确认库存与金额。</Text>
      </View>

      {needsLogin || !isLoggedIn() ? (
        <View className='brand-empty-card'>
          <Image className='brand-empty-image' src={emptyOrderImage} mode='aspectFill' />
          <Text className='cart-empty-title'>请先登录后查看购物车</Text>
          <Text className='cart-empty-copy'>登录后可以保存购物车，并继续完成下单。</Text>
          <Button
            className='ui-pressable ui-primary-button'
            hoverClass='ui-pressable-hover'
            type='primary'
            onClick={() => redirectToCustomerLogin('/pages/cart/index')}
          >
            去登录
          </Button>
        </View>
      ) : loading ? (
        <View className='ui-skeleton-card'>
          <Text className='cart-loading-title'>正在加载购物车…</Text>
          <View className='ui-skeleton-block' style={{ height: '180rpx', marginBottom: '24rpx' }} />
          <View className='ui-skeleton-line' style={{ width: '82%', marginBottom: '16rpx' }} />
          <View className='ui-skeleton-line' style={{ width: '60%' }} />
        </View>
      ) : error ? (
        <View className='cart-error-card'>
          <Text className='cart-empty-title'>购物车暂时不可用</Text>
          <Text className='cart-empty-copy'>{error}</Text>
          <Button className='ui-pressable ui-primary-button' hoverClass='ui-pressable-hover' type='primary' onClick={() => loadCart()}>
            重试
          </Button>
        </View>
      ) : !hasItems ? (
        <View className='brand-empty-card'>
          <Image className='brand-empty-image' src={emptyOrderImage} mode='aspectFill' />
          <Text className='cart-empty-title'>购物车还是空的</Text>
          <Text className='cart-empty-copy'>可以先去店铺挑选海味干货，结算前会再次确认库存与金额。</Text>
          <Button
            className='ui-pressable ui-primary-button'
            hoverClass='ui-pressable-hover'
            type='primary'
            onClick={() => Taro.switchTab({ url: '/pages/catalog/index' })}
          >
            去选商品
          </Button>
        </View>
      ) : (
        <View className='cart-list'>
          {cartItems.map((item) => {
            const isActing = actingItemId === item.id;

            return (
              <View className='cart-item-card ui-card-pressable' hoverClass='ui-card-pressable-hover' key={item.id}>
                {/* Phase 2.51D：鲜鱼用 fresh 真图(coverImageUrl)，干货保持 getProductCover(按名)，鲜鱼绝不 fallback 干货/汤料图 */}
                <Image className='cart-item-image' src={item.product.isFreshPreorder ? getFreshProductCover(item.product.coverImageUrl) : getProductCover(item.product.name)} mode='aspectFill' />
                <View className='cart-item-main'>
                  <View className='cart-item-header'>
                    <Text className='cart-item-title'>{sanitizeProductDisplayName(item.product.name)}</Text>
                    <Button className='cart-remove-button ui-pressable' hoverClass='ui-pressable-hover' size='mini' disabled={isActing} onClick={() => removeItem(item)}>
                      移除
                    </Button>
                  </View>
                  <Text className='cart-item-spec'>规格：{item.sku.name}</Text>
                  {item.product.isFreshPreorder ? (
                    <Text style={{ display: 'block', fontSize: '22rpx', color: '#2e7568', fontWeight: '700', marginTop: '2rpx' }}>
                      新鲜渔产 · 售价 {formatPriceCents(item.unitPriceCents)}/斤 · 数量按斤计（1 份=1 斤）
                    </Text>
                  ) : (
                    <Text className='cart-item-stock'>当前可售约 {item.availableStock} 件</Text>
                  )}
                  <View className='cart-item-footer'>
                    <View className='cart-item-price-block'>
                      <Text className='cart-item-unit-price'>单价 {formatPriceCents(item.unitPriceCents)}</Text>
                      <Text className='cart-item-line-total'>小计 {formatPriceCents(getLineAmountCents(item))}</Text>
                    </View>
                    <View className='cart-quantity-control'>
                      <Button
                        className='cart-quantity-button ui-pressable'
                        hoverClass='ui-pressable-hover'
                        size='mini'
                        disabled={item.quantity <= 1 || isActing}
                        onClick={() => updateQuantity(item, item.quantity - 1)}
                      >
                        -
                      </Button>
                      <Text className='cart-quantity-value'>{item.quantity}</Text>
                      <Button
                        className='cart-quantity-button ui-pressable'
                        hoverClass='ui-pressable-hover'
                        size='mini'
                        disabled={item.quantity >= item.availableStock || isActing}
                        onClick={() => updateQuantity(item, item.quantity + 1)}
                      >
                        +
                      </Button>
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {hasItems ? (
        <View className='cart-checkout-bar'>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text className='cart-checkout-label'>共 {cartItemCount} 件</Text>
            <Text className='cart-checkout-total'>
              {formatPriceCents(cartSubtotalAmountCents)}
            </Text>
            {/* Phase 2.51D：混车提示——鲜鱼按斤、干货按规格 */}
            <Text style={{ display: 'block', fontSize: '20rpx', color: '#6e8791' }}>鲜鱼按斤计价，干货按规格计价，结算前请确认数量。</Text>
          </View>
          {/* Phase 2.51G：底部按钮一行居中、不换行、间距统一 */}
          <View style={{ display: 'flex', gap: '16rpx', alignItems: 'center', flexShrink: 0 }}>
            <Button className='ui-pressable cart-action-clear' hoverClass='ui-pressable-hover' disabled={actingItemId === '__clear__'} onClick={clearCart}>
              {actingItemId === '__clear__' ? '清空中' : '清空购物车'}
            </Button>
            <Button className='ui-pressable ui-primary-button cart-action-checkout' hoverClass='ui-pressable-hover' type='primary' onClick={goCheckout}>
              去结算
            </Button>
          </View>
        </View>
      ) : null}
    </View>
  );
}
