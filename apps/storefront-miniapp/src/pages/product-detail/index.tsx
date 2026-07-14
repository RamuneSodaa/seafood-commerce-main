import { useEffect, useMemo, useState } from 'react';
import Taro, { useRouter, useShareAppMessage } from '@tarojs/taro';
import { Button, Image, Text, View } from '@tarojs/components';

import { getFreshProductCover, getProductArtwork } from '../../lib/product-artwork';
import { sanitizeProductDisplayName } from '../../lib/product-display-name';
import { addCartItem, getMyInvite, getProduct, type ProductDetail } from '../../lib/api';
import { redirectToCustomerLogin } from '../../lib/customer-login-redirect';
import { getMiniappIdentitySource } from '../../lib/identity';
import { getStoredCustomerAuthArtifact, setPendingInviteCode } from '../../lib/identity-storage';

function formatPriceCents(amountCents: number): string {
  const value = (Number(amountCents) || 0) / 100;
  return `¥${value.toFixed(2)}`;
}

function getFulfillmentSummary(product: ProductDetail): string {
  const options: string[] = [];

  if (product.supportsPickup) options.push('到店自提');
  if (product.supportsShipping) options.push('邮寄发货');

  if (options.length === 0) return '当前暂无可用取货方式';
  return options.join(' / ');
}

function getPriceRange(product: ProductDetail): string {
  if (product.skus.length === 0) return '暂无价格';

  const prices = product.skus.map((sku) => sku.memberPriceCents || sku.priceCents);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  if (minPrice === maxPrice) {
    return formatPriceCents(minPrice);
  }

  return `${formatPriceCents(minPrice)} - ${formatPriceCents(maxPrice)}`;
}


function getReadableErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && /[\u4e00-\u9fa5]/.test(error.message)) {
    return error.message;
  }

  return fallback;
}

function getSkuAvailableStock(sku: { availableStock?: number } | null | undefined): number {
  return Math.max(0, sku?.availableStock || 0);
}

function hasCurrentCustomerLogin(): boolean {
  return getMiniappIdentitySource() === 'real-storage' && Boolean(getStoredCustomerAuthArtifact());
}

export default function ProductDetailPage() {
  const router = useRouter();
  const productId = router.params?.productId || '';

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSkuId, setSelectedSkuId] = useState('');
  const [cartSubmitting, setCartSubmitting] = useState(false);
  const [shareInviteCode, setShareInviteCode] = useState('');

  async function loadProduct() {
    if (!productId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await getProduct(productId);
      setProduct(data);
      setSelectedSkuId((current) => current || data.skus[0]?.id || '');
    } catch (e) {
      setError(getReadableErrorMessage(e, '商品详情加载失败，请稍后重试。'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const incomingInviteCode = router.params?.inviteCode?.trim();
    if (incomingInviteCode) {
      setPendingInviteCode(incomingInviteCode);
    }

    loadProduct();
  }, [productId]);

  useEffect(() => {
    if (!hasCurrentCustomerLogin()) return;

    let isActive = true;

    async function loadInviteCode() {
      try {
        const invite = await getMyInvite();
        if (isActive) setShareInviteCode(invite.inviteCode);
      } catch (e) {
        console.warn('邀请信息读取失败', e);
      }
    }

    loadInviteCode();

    return () => {
      isActive = false;
    };
  }, []);

  useShareAppMessage(() => {
    const inviteQuery = shareInviteCode ? `&inviteCode=${encodeURIComponent(shareInviteCode)}` : '';

    return {
      title: product ? `绿膳荟严选：${sanitizeProductDisplayName(product.name)}` : '绿膳荟干货海味店',
      path: `/pages/product-detail/index?productId=${productId}${inviteQuery}`
    };
  });

  const selectedSku = useMemo(
    () => product?.skus.find((sku) => sku.id === selectedSkuId) ?? product?.skus[0] ?? null,
    [product, selectedSkuId]
  );
  const productArtwork = product ? getProductArtwork(product.name) : getProductArtwork('');
  // Phase 2.49L-a：fresh 商品封面优先 coverImageUrl、缺失用 fresh 占位图；绝不走 getProductArtwork(干货图)。dry 保持原逻辑。
  const isFreshDetail = product?.internalTag === 'fresh_seafood_catalog';
  const detailCoverSrc = isFreshDetail ? getFreshProductCover(product?.coverImageUrl) : productArtwork.coverSrc;

  async function handleAddToCart() {
    if (!selectedSku) {
      Taro.showToast({ title: '当前没有可用规格', icon: 'none' });
      return;
    }

    if (!hasCurrentCustomerLogin()) {
      redirectToCustomerLogin(`/pages/product-detail/index?productId=${productId}`);
      return;
    }

    if (getSkuAvailableStock(selectedSku) < 1) {
      Taro.showToast({ title: '当前规格库存不足', icon: 'none' });
      return;
    }

    setCartSubmitting(true);

    try {
      const nextCart = await addCartItem(selectedSku.id, 1);
      console.warn('加入购物车成功', {
        skuId: selectedSku.id,
        quantity: 1,
        itemCount: nextCart.itemCount,
        subtotalAmountCents: nextCart.subtotalAmountCents
      });
      Taro.showToast({ title: '已加入购物车', icon: 'success' });
    } catch (e) {
      Taro.showToast({
        title: getReadableErrorMessage(e, '加入购物车失败'),
        icon: 'none'
      });
    } finally {
      setCartSubmitting(false);
    }
  }

  return (
    <View className='page-fade-in' style={{ minHeight: '100vh', padding: '28rpx', paddingBottom: product ? '150rpx' : '28rpx', background: '#fff8ea' }}>
      <View
        style={{
          background: '#ffffff',
          borderRadius: '24rpx',
          padding: '24rpx',
          marginBottom: '24rpx',
          boxShadow: '0 8rpx 24rpx rgba(23, 35, 28, 0.05)',
          border: '2rpx solid #e8e0d3'
        }}
      >
        <Text style={{ display: 'block', fontSize: '24rpx', color: '#236b45', fontWeight: '700', marginBottom: '8rpx' }}>
          新中式滋补 · 绿膳荟严选
        </Text>
        <Text style={{ display: 'block', fontSize: '36rpx', fontWeight: '800', color: '#17231c' }}>商品详情</Text>
      </View>

      {!productId ? (
        <View
          style={{
            background: '#ffffff',
            borderRadius: '24rpx',
            padding: '28rpx',
            textAlign: 'center'
          }}
        >
          <Text style={{ display: 'block', color: '#6b7280', marginBottom: '16rpx' }}>请从商品列表重新进入商品详情。</Text>
          <Button className='ui-pressable ui-primary-button' hoverClass='ui-pressable-hover' size='mini' type='primary' onClick={() => Taro.navigateBack()}>
            返回商品列表
          </Button>
        </View>
      ) : loading ? (
        <View className='ui-skeleton-card'>
          <Text style={{ display: 'block', fontSize: '28rpx', fontWeight: '600', color: '#17231c', marginBottom: '20rpx' }}>
            正在加载商品详情…
          </Text>
          <View className='ui-skeleton-block' style={{ height: '300rpx', marginBottom: '24rpx' }} />
          <View className='ui-skeleton-line' style={{ width: '62%', marginBottom: '16rpx' }} />
          <View className='ui-skeleton-line' style={{ width: '90%', marginBottom: '22rpx' }} />
          <View className='ui-skeleton-pill' style={{ width: '220rpx' }} />
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
          <Text style={{ display: 'block', fontSize: '30rpx', fontWeight: '600', marginBottom: '12rpx' }}>商品详情加载失败</Text>
          <Text style={{ display: 'block', fontSize: '26rpx', color: '#9f2a1d', marginBottom: '20rpx' }}>{error}</Text>
          <View style={{ display: 'flex', gap: '16rpx' }}>
            <Button className='ui-pressable ui-primary-button' hoverClass='ui-pressable-hover' size='mini' type='primary' onClick={loadProduct}>
              重试
            </Button>
            <Button className='ui-pressable' hoverClass='ui-pressable-hover' size='mini' onClick={() => Taro.navigateBack()}>
              返回列表
            </Button>
          </View>
        </View>
      ) : !product ? (
        <View
          style={{
            background: '#ffffff',
            borderRadius: '24rpx',
            padding: '28rpx',
            textAlign: 'center'
          }}
        >
          <Text style={{ display: 'block', color: '#6b7280', marginBottom: '16rpx' }}>当前商品不存在或暂未发布。</Text>
          <Button className='ui-pressable ui-primary-button' hoverClass='ui-pressable-hover' size='mini' type='primary' onClick={() => Taro.navigateBack()}>
            返回商品列表
          </Button>
        </View>
      ) : (
        <View style={{ display: 'flex', flexDirection: 'column', gap: '24rpx' }}>
          <View
            style={{
              background: '#ffffff',
              borderRadius: '24rpx',
              padding: '22rpx',
              boxShadow: '0 8rpx 24rpx rgba(23, 35, 28, 0.06)',
              border: '2rpx solid #e8e0d3'
            }}
          >
            <View className='product-detail-cover-card'>
              <Image className='product-detail-cover-image' src={detailCoverSrc} mode='aspectFill' />
              <View className='product-detail-cover-badge'>
                <Text>绿膳荟严选</Text>
              </View>
              <View className='product-detail-cover-copy'>
                <Text>{isFreshDetail ? (product?.name ?? '新鲜渔产') : productArtwork.title}</Text>
                <Text>{isFreshDetail ? '今日鲜货 · 门店称重' : productArtwork.subtitle}</Text>
              </View>
            </View>
            <Text style={{ display: 'block', fontSize: '40rpx', fontWeight: '800', color: '#17231c', marginBottom: '12rpx' }}>
              {sanitizeProductDisplayName(product.name)}
            </Text>
            <Text style={{ display: 'block', fontSize: '26rpx', color: '#6b7280', marginBottom: '18rpx' }}>
              {product.description?.trim() || '精选海味干货，适合家庭囤货、煲汤和节日送礼。'}
            </Text>
            <View style={{ display: 'flex', justifyContent: 'space-between', gap: '16rpx', alignItems: 'flex-end' }}>
              <View>
                <Text style={{ display: 'block', fontSize: '24rpx', color: '#6b7280' }}>价格</Text>
                <Text style={{ display: 'block', fontSize: '38rpx', fontWeight: '800', color: '#d94836' }}>{getPriceRange(product)}</Text>
              </View>
              <View style={{ padding: '8rpx 16rpx', borderRadius: '999rpx', background: '#eaf6ee', border: '2rpx solid #d8ead9' }}>
                <Text style={{ fontSize: '22rpx', color: '#236b45', fontWeight: '700' }}>{getFulfillmentSummary(product)}</Text>
              </View>
            </View>
          </View>

          <View
            style={{
              background: '#ffffff',
              borderRadius: '24rpx',
              padding: '28rpx',
              boxShadow: '0 8rpx 24rpx rgba(23, 35, 28, 0.06)',
              border: '2rpx solid #e8e0d3'
            }}
          >
            <Text style={{ display: 'block', fontSize: '32rpx', fontWeight: '800', marginBottom: '6rpx', color: '#17231c' }}>选择规格</Text>
            <Text style={{ display: 'block', fontSize: '24rpx', color: '#6b7280', marginBottom: '18rpx' }}>不同规格价格可能不同，请确认后下单。</Text>

            {product.skus.length === 0 ? (
              <Text style={{ display: 'block', color: '#6b7280' }}>当前商品还没有可售规格。</Text>
            ) : (
              <View style={{ display: 'flex', flexDirection: 'column', gap: '18rpx' }}>
                {product.skus.map((sku) => (
                  <View
                    key={sku.id}
                    className='ui-card-pressable'
                    hoverClass='ui-card-pressable-hover'
                    onClick={() => setSelectedSkuId(sku.id)}
                    style={{
                      padding: '22rpx',
                      borderRadius: '18rpx',
                      background: selectedSku?.id === sku.id ? '#eaf6ee' : '#fffdfa',
                      border: selectedSku?.id === sku.id ? '2rpx solid #236b45' : '2rpx solid #e8e0d3'
                    }}
                  >
                    <View style={{ display: 'flex', justifyContent: 'space-between', gap: '16rpx' }}>
                      <Text style={{ display: 'block', fontSize: '28rpx', fontWeight: '700', marginBottom: '8rpx', flex: 1 }}>
                        {sku.name}
                      </Text>
                      {selectedSku?.id === sku.id ? (
                        <View style={{ padding: '4rpx 12rpx', borderRadius: '999rpx', background: '#236b45', alignSelf: 'flex-start' }}>
                          <Text style={{ fontSize: '22rpx', color: '#ffffff', fontWeight: '700' }}>已选</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={{ display: 'block', fontSize: '24rpx', color: '#6b7280', marginBottom: '10rpx' }}>
                      支持广州门店自提与邮寄发货
                    </Text>
                    <Text style={{ display: 'block', fontSize: '32rpx', fontWeight: '800', color: '#d94836' }}>
                      {formatPriceCents(sku.memberPriceCents || sku.priceCents)}
                    </Text>
                    {sku.memberPriceCents && sku.memberPriceCents < sku.priceCents ? (
                      <Text style={{ display: 'block', fontSize: '22rpx', color: '#236b45', marginTop: '6rpx', fontWeight: '700' }}>
                        会员价已生效
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      )}

      {product ? (
        <View
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            padding: '18rpx 28rpx 28rpx',
            background: '#ffffff',
            borderTop: '2rpx solid #e8e0d3',
            boxShadow: '0 -10rpx 24rpx rgba(23, 35, 28, 0.08)',
            display: 'flex',
            gap: '16rpx'
          }}
        >
          <Button
            className='ui-pressable'
            hoverClass='ui-pressable-hover'
            style={{ flex: 1 }}
            disabled={cartSubmitting || !selectedSku}
            loading={cartSubmitting}
            onClick={handleAddToCart}
          >
            {cartSubmitting ? '加入中' : '加入购物车'}
          </Button>
          <Button
            className='ui-pressable ui-primary-button'
            hoverClass='ui-pressable-hover'
            style={{ flex: 2 }}
            type='primary'
            onClick={() => {
              if (!selectedSku) {
                Taro.showToast({
                  title: '当前没有可用规格',
                  icon: 'none'
                });
                return;
              }

              Taro.navigateTo({
                url: `/pages/checkout/index?productId=${product.id}&skuId=${selectedSku.id}&qty=1`
              });
            }}
          >
            立即购买
          </Button>
        </View>
      ) : null}
    </View>
  );
}
