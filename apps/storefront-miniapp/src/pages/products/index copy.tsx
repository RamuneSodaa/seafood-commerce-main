import { useEffect, useMemo, useState } from 'react';
import Taro, { useRouter } from '@tarojs/taro';
import { Button, Image, Input, RootPortal, Text, View } from '@tarojs/components';

import emptyOrderImage from '../../assets/brand/empty-order.jpg';
import homeHeroImage from '../../assets/brand/home-hero.jpg';
// Phase 2.48F：新鲜渔产频道专属 hero（用户提供的门店冰鲜场景图，左侧留白、右侧鱼虾贝章鱼，奶白/浅蓝/淡绿）。
import freshHeroImage from '../../assets/brand/fresh_seafood_hero.png';
// Phase 2.48G：鲜鱼分类辅助小图（用户鱼货图缩略，克制使用，仅作分类入口视觉提示）。
import freshCatSeaFish from '../../assets/brand/fresh/fresh_cat_sea_fish.jpg';
import freshCatShrimpShell from '../../assets/brand/fresh/fresh_cat_shrimp_shell.jpg';
import freshCatOctopusSquid from '../../assets/brand/fresh/fresh_cat_octopus_squid.jpg';
import freshCatPremiumFish from '../../assets/brand/fresh/fresh_cat_premium_fish.jpg';
import freshCatMisc from '../../assets/brand/fresh/fresh_cat_misc.jpg';

// Phase 2.48K：鲜鱼频道功能小图标（真透明 PNG，轻量点缀）。
import iconDailyArrival from '../../assets/brand/fresh/icons/daily_arrival.png';
import iconMarketPrice from '../../assets/brand/fresh/icons/market_price_weighing.png';
import iconContactStore from '../../assets/brand/fresh/icons/contact_store.png';
import iconInstoreWeighing from '../../assets/brand/fresh/icons/instore_weighing.png';
import iconAddReservation from '../../assets/brand/fresh/icons/add_reservation.png';

// Phase 2.48G：鲜鱼分类 → 辅助小图映射（“全部”无图）。
const FRESH_CATEGORY_THUMBS: Record<string, string> = {
  野生海鱼: freshCatSeaFish,
  鲜虾贝蚝: freshCatShrimpShell,
  章鱼鱿鱼: freshCatOctopusSquid,
  石斑贵价鱼: freshCatPremiumFish,
  '杂鱼/其它': freshCatMisc
};
import { getFreshProductCover, getProductArtwork } from '../../lib/product-artwork';
import { sanitizeProductDisplayName } from '../../lib/product-display-name';
import serviceDeliveryImage from '../../assets/brand/service-delivery.jpg';
import serviceSelectImage from '../../assets/brand/service-select.jpg';
import serviceSoupImage from '../../assets/brand/service-soup.jpg';
import serviceStoreImage from '../../assets/brand/service-store.jpg';
import { addCartItem, getFreshCatalog, getProducts, type FreshCatalogItem, type ProductSku, type ProductSummary } from '../../lib/api';
import { getCategoryIcon } from '../../lib/category-icons';
import { redirectToCustomerLogin } from '../../lib/customer-login-redirect';
import { getMiniappIdentitySource } from '../../lib/identity';
import { getStoredCustomerAuthArtifact, setPendingInviteCode } from '../../lib/identity-storage';

const SERVICE_ENTRIES = [
  { label: '线下门店', image: serviceStoreImage },
  { label: '到店自提', image: serviceSelectImage },
  { label: '邮寄发货', image: serviceDeliveryImage },
  { label: '滋补汤料', image: serviceSoupImage }
];

const PRODUCT_CATEGORIES = ['全部', '今日推荐', '滋补汤料', '干贝瑶柱', '花胶鱼胶', '海味干货', '礼盒套装'];

function formatPriceCents(amountCents: number): string {
  const value = (Number(amountCents) || 0) / 100;
  return `¥${value.toFixed(2)}`;
}

function getStartingPrice(product: ProductSummary): string {
  if (product.skus.length === 0) return '暂无价格';
  const minPrice = Math.min(...product.skus.map((sku) => sku.memberPriceCents || sku.priceCents));
  return `${formatPriceCents(minPrice)} 起`;
}

function getPriceRange(product: ProductSummary): string {
  if (product.skus.length === 0) return '暂无价格';

  const prices = product.skus.map((sku) => sku.memberPriceCents || sku.priceCents);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  if (minPrice === maxPrice) {
    return formatPriceCents(minPrice);
  }

  return `${formatPriceCents(minPrice)} - ${formatPriceCents(maxPrice)}`;
}

function getSkuAvailableStock(sku: ProductSku | null | undefined): number {
  return Math.max(0, sku?.availableStock || 0);
}

function getProductAvailableStock(product: ProductSummary): number {
  return product.skus.reduce((sum, sku) => sum + getSkuAvailableStock(sku), 0);
}

function getFulfillmentLabels(product: ProductSummary): string[] {
  const labels: string[] = [];

  if (product.supportsPickup) labels.push('到店自提');
  if (product.supportsShipping) labels.push('邮寄发货');

  return labels.length > 0 ? labels : ['暂未开放'];
}

function getSkuSummary(product: ProductSummary): string {
  if (product.skus.length === 0) return '暂无可售规格';

  return product.skus.map((sku) => sku.name).join(' / ');
}


function getReadableErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && /[\u4e00-\u9fa5]/.test(error.message)) {
    return error.message;
  }

  return fallback;
}

function getProductLoadErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || '');

  if (/request:fail|timeout|connect|connection|ECONNREFUSED|network|Failed to fetch/i.test(message)) {
    return '商品服务暂时连接不上，请稍后重试。';
  }

  return '商品数据暂时不可用，请稍后重试。';
}

function hasCurrentCustomerLogin(): boolean {
  return getMiniappIdentitySource() === 'real-storage' && Boolean(getStoredCustomerAuthArtifact());
}

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<ProductSummary[]>([]);
  // Phase 2.48C：双频道。'dry'=干货汤料（默认，原逻辑）；'fresh'=新鲜渔产（展示型，不加购/不支付）。
  const [channel, setChannel] = useState<'dry' | 'fresh'>('dry');
  const [freshItems, setFreshItems] = useState<FreshCatalogItem[]>([]);
  const [freshCategory, setFreshCategory] = useState('全部');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState('全部');
  const [searchInput, setSearchInput] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [skuSheetProduct, setSkuSheetProduct] = useState<ProductSummary | null>(null);
  const [sheetSkuId, setSheetSkuId] = useState('');
  const [sheetQty, setSheetQty] = useState(1);
  // Phase 2.51E：鲜鱼规格购买弹窗状态
  const [freshSheetItem, setFreshSheetItem] = useState<FreshCatalogItem | null>(null);
  const [freshSheetQty, setFreshSheetQty] = useState(1);
  const [cartSubmitting, setCartSubmitting] = useState(false);
  const hasRealCustomerLogin = hasCurrentCustomerLogin();

  async function loadProducts() {
    setLoading(true);
    setError('');

    try {
      if (channel === 'fresh') {
        const fresh = await getFreshCatalog();
        setFreshItems(fresh);
      } else {
        const data = await getProducts({
          category: activeCategory === '全部' ? undefined : activeCategory,
          q: searchKeyword
        });
        setProducts(data);
      }
    } catch (e) {
      console.warn('商品加载失败', e);
      setError(getProductLoadErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const incomingInviteCode = router.params?.inviteCode?.trim();
    if (incomingInviteCode) {
      setPendingInviteCode(incomingInviteCode);
    }

    Taro.setNavigationBarTitle({ title: '绿膳荟' });
    loadProducts();
  }, [activeCategory, searchKeyword, channel]);

  const selectedSheetSku = useMemo(
    () => skuSheetProduct?.skus.find((sku) => sku.id === sheetSkuId) ?? skuSheetProduct?.skus[0] ?? null,
    [skuSheetProduct, sheetSkuId]
  );

  function openSkuSheet(product: ProductSummary) {
    setSkuSheetProduct(product);
    setSheetSkuId(product.skus[0]?.id || '');
    setSheetQty(1);
  }

  function closeSkuSheet() {
    if (cartSubmitting) return;
    setSkuSheetProduct(null);
    setSheetSkuId('');
    setSheetQty(1);
  }

  // Phase 2.51E：鲜鱼规格购买底部弹窗（复用干货弹窗视觉；鲜鱼单规格按斤）。
  function openFreshSheet(item: FreshCatalogItem) {
    if (!item.skuId || !item.canAddToCart) {
      Taro.showToast({ title: '该鲜货暂不可购买', icon: 'none' });
      return;
    }
    setFreshSheetItem(item);
    setFreshSheetQty(1);
  }

  function closeFreshSheet() {
    if (cartSubmitting) return;
    setFreshSheetItem(null);
    setFreshSheetQty(1);
  }

  async function handleFreshSheetAddToCart() {
    if (!freshSheetItem?.skuId) return;
    if (!ensureLoggedInForCart()) return;
    try {
      setCartSubmitting(true);
      await addCartItem(freshSheetItem.skuId, freshSheetQty);
      Taro.showToast({ title: '已加入购物车', icon: 'success' });
      setFreshSheetItem(null);
      setFreshSheetQty(1);
    } catch (e) {
      Taro.showToast({ title: getReadableErrorMessage(e, '加入购物车失败'), icon: 'none' });
    } finally {
      setCartSubmitting(false);
    }
  }

  // 鲜鱼「立即购买」：鲜鱼为 unpublished（干货式 checkout 页依赖已发布商品详情，不适用），
  // 故复用"加入购物车→进入购物车"流程（不创建订单、不触发支付）。
  async function handleFreshSheetBuyNow() {
    if (!freshSheetItem?.skuId) return;
    if (!ensureLoggedInForCart()) return;
    try {
      setCartSubmitting(true);
      await addCartItem(freshSheetItem.skuId, freshSheetQty);
      setFreshSheetItem(null);
      setFreshSheetQty(1);
      Taro.navigateTo({ url: '/pages/cart/index' });
    } catch (e) {
      Taro.showToast({ title: getReadableErrorMessage(e, '操作失败'), icon: 'none' });
    } finally {
      setCartSubmitting(false);
    }
  }

  function ensureLoggedInForCart(): boolean {
    if (hasCurrentCustomerLogin()) {
      return true;
    }

    redirectToCustomerLogin('/pages/products/index');
    return false;
  }


  async function handleAddToCart() {
    if (!skuSheetProduct || !selectedSheetSku) {
      Taro.showToast({ title: '请先选择规格', icon: 'none' });
      return;
    }

    if (!ensureLoggedInForCart()) {
      return;
    }

    if (getSkuAvailableStock(selectedSheetSku) < sheetQty) {
      Taro.showToast({ title: '当前规格库存不足', icon: 'none' });
      return;
    }

    setCartSubmitting(true);

    try {
      const nextCart = await addCartItem(selectedSheetSku.id, sheetQty);
      console.warn('加入购物车成功', {
        skuId: selectedSheetSku.id,
        quantity: sheetQty,
        itemCount: nextCart.itemCount,
        subtotalAmountCents: nextCart.subtotalAmountCents
      });
      Taro.showToast({ title: '已加入购物车', icon: 'success' });
      setSkuSheetProduct(null);
      setSheetSkuId('');
      setSheetQty(1);
    } catch (e) {
      Taro.showToast({
        title: getReadableErrorMessage(e, '加入购物车失败'),
        icon: 'none'
      });
    } finally {
      setCartSubmitting(false);
    }
  }

  function handleBuyNow() {
    if (!skuSheetProduct || !selectedSheetSku) {
      Taro.showToast({ title: '请先选择规格', icon: 'none' });
      return;
    }

    if (getSkuAvailableStock(selectedSheetSku) < sheetQty) {
      Taro.showToast({ title: '当前规格库存不足', icon: 'none' });
      return;
    }

    Taro.navigateTo({
      url: `/pages/checkout/index?productId=${skuSheetProduct.id}&skuId=${selectedSheetSku.id}&qty=${sheetQty}`
    });
  }

  return (
    <View className='page-fade-in' style={{ minHeight: '100vh', padding: '28rpx', background: channel === 'fresh' ? '#f1faf8' : '#fff8ea' }}>
      {channel === 'fresh' ? (
        // Phase 2.48E：新鲜渔产专属 hero（蓝白冰鲜风，独立海鲜背景图 + 海蓝遮罩，不复用干货顶部图）。
        <View
          style={{
            position: 'relative',
            borderRadius: '28rpx',
            overflow: 'hidden',
            marginBottom: '24rpx',
            minHeight: '320rpx',
            boxShadow: '0 16rpx 36rpx rgba(47, 126, 165, 0.16)',
            border: '2rpx solid #bfdcd6'
          }}
        >
          <Image src={freshHeroImage} mode='aspectFill' style={{ position: 'absolute', top: '0', left: '0', width: '100%', height: '100%' }} />
          {/* 仅左侧加柔和奶白渐变，保留图片自然光与右侧鲜货；不压暗整图 */}
          <View style={{ position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', background: 'linear-gradient(90deg, rgba(248,252,253,0.86) 0%, rgba(248,252,253,0.5) 38%, rgba(248,252,253,0) 62%)' }} />
          <View style={{ position: 'relative', padding: '38rpx 30rpx', maxWidth: '62%' }}>
            <Text style={{ display: 'block', fontSize: '24rpx', color: '#2f7f91', fontWeight: '700', marginBottom: '8rpx' }}>绿膳荟 · 今日鲜档</Text>
            <Text style={{ display: 'block', fontSize: '46rpx', color: '#263f48', fontWeight: '900', marginBottom: '10rpx' }}>今日新鲜渔产</Text>
            <Text style={{ display: 'block', fontSize: '24rpx', color: '#6e8791', marginBottom: '18rpx', lineHeight: '1.5' }}>每日到货 · 时价称重 · 联系确认</Text>
            <View style={{ display: 'flex', gap: '12rpx', flexWrap: 'wrap' }}>
              {['每日到货', '时价称重', '野生海鲜'].map((t) => (
                <View key={t} style={{ padding: '6rpx 18rpx', borderRadius: '999rpx', background: 'rgba(255,255,255,0.78)', border: '2rpx solid #bfdcd6' }}>
                  <Text style={{ fontSize: '22rpx', color: '#263f48', fontWeight: '700' }}>{t}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      ) : (
      <View
        className='brand-hero brand-hero-home'
        style={{
          borderRadius: '28rpx',
          padding: '0',
          marginBottom: '24rpx',
          boxShadow: '0 16rpx 36rpx rgba(35, 107, 69, 0.13)',
          border: '2rpx solid #e8e0d3'
        }}
      >
        <Image className='brand-hero-bg' src={homeHeroImage} mode='aspectFill' />
        <View className='brand-hero-shade' />
        <View className='brand-hero-content'>
          <Text className='brand-hero-kicker'>广州连锁门店</Text>
          <Text className='brand-hero-title'>绿膳荟干货海味店</Text>
          <Text className='brand-hero-subtitle'>精选干货海味，支持到店自提与邮寄发货。</Text>
          <View className='brand-hero-tags'>
            {['门店自提', '邮寄发货', '滋补汤料'].map((label) => (
              <View className='brand-hero-tag' key={label}>
                <Text>{label}</Text>
              </View>
            ))}
          </View>
        </View>
        <View className='brand-hero-actions'>
          <Button
            className='ui-pressable ui-secondary-button'
            hoverClass='ui-pressable-hover'
            size='mini'
            plain
            style={{ borderColor: '#e8e0d3', color: '#236b45', background: '#fffdfa' }}
            onClick={() => {
              Taro.switchTab({
                url: '/pages/customer-login/index'
              });
            }}
          >
            {hasRealCustomerLogin ? '重新登录' : '登录'}
          </Button>
          <Button
            className='ui-pressable ui-primary-button'
            hoverClass='ui-pressable-hover'
            size='mini'
            type='primary'
            style={{ paddingLeft: '26rpx', paddingRight: '26rpx' }}
            onClick={() => {
              Taro.switchTab({
                url: '/pages/orders/index'
              });
            }}
          >
            我的订单
          </Button>
        </View>
      </View>
      )}

      {/* Phase 2.48C：双频道入口（干货汤料 / 新鲜渔产）。默认干货。 */}
      <View style={{ display: 'flex', gap: '16rpx', marginBottom: '24rpx' }}>
        {([
          { key: 'dry', label: '干货汤料', sub: '固定价 · 可下单' },
          { key: 'fresh', label: '新鲜渔产', sub: '每日到货 · 时价' }
        ] as const).map((tab) => (
          <View
            key={tab.key}
            onClick={() => setChannel(tab.key)}
            style={{
              flex: 1,
              padding: '20rpx',
              borderRadius: '20rpx',
              textAlign: 'center',
              // 干货=绿（煲汤滋补），新鲜渔产=蓝（冰鲜水产），两频道视觉明显区分。
              background: channel === tab.key ? (tab.key === 'fresh' ? '#2f7f91' : '#236b45') : '#ffffff',
              border: channel === tab.key ? '2rpx solid transparent' : (tab.key === 'fresh' ? '2rpx solid #bfdcd6' : '2rpx solid #e8e0d3'),
              boxShadow: '0 8rpx 20rpx rgba(15,91,134,0.08)'
            }}
          >
            <Text style={{ display: 'block', fontSize: '30rpx', fontWeight: '800', color: channel === tab.key ? '#ffffff' : (tab.key === 'fresh' ? '#2f7f91' : '#17231c') }}>
              {tab.label}
            </Text>
            <Text style={{ display: 'block', fontSize: '22rpx', marginTop: '6rpx', color: channel === tab.key ? '#dbeefa' : '#6b7280' }}>
              {tab.sub}
            </Text>
          </View>
        ))}
      </View>

      {channel === 'fresh' ? (
        loading ? (
          <View className='ui-skeleton-card'>
            <Text style={{ display: 'block', fontSize: '28rpx', color: '#17231c', marginBottom: '16rpx' }}>正在加载新鲜渔产…</Text>
            <View className='ui-skeleton-line' style={{ width: '70%' }} />
          </View>
        ) : error ? (
          <View style={{ background: '#fdecec', borderRadius: '24rpx', padding: '28rpx', border: '2rpx solid #f6c7c7' }}>
            <Text style={{ display: 'block', fontSize: '26rpx', color: '#9f2a1d', marginBottom: '16rpx' }}>{error}</Text>
            <Button className='ui-pressable ui-primary-button' size='mini' type='primary' onClick={loadProducts}>重试</Button>
          </View>
        ) : (
          // Phase 2.48D：新鲜渔产独立专区（冰鲜蓝白风，独立卡片，不复用干货卡逻辑）。
          <View style={{ display: 'flex', flexDirection: 'column', gap: '20rpx' }}>
            {/* 到货说明（功能提示，弱化与 hero 标题的重复；hero 已负责大标题） */}
            <View style={{ background: '#e7f5f2', borderRadius: '20rpx', padding: '20rpx 22rpx', border: '2rpx solid #bfdcd6' }}>
              <Text style={{ display: 'block', fontSize: '24rpx', fontWeight: '800', color: '#263f48', marginBottom: '10rpx' }}>到货说明</Text>
              <View style={{ display: 'flex', gap: '24rpx', marginBottom: '10rpx' }}>
                {[{ i: iconDailyArrival, t: '每日到货' }, { i: iconMarketPrice, t: '时价称重' }, { i: iconContactStore, t: '联系门店' }].map((x) => (
                  <View key={x.t} style={{ display: 'flex', alignItems: 'center', gap: '8rpx' }}>
                    <Image src={x.i} mode='aspectFit' style={{ width: '34rpx', height: '34rpx' }} />
                    <Text style={{ fontSize: '22rpx', color: '#2f7f91', fontWeight: '700' }}>{x.t}</Text>
                  </View>
                ))}
              </View>
              <Text style={{ display: 'block', fontSize: '23rpx', color: '#6e8791', lineHeight: '1.6' }}>
                每日到货、数量有限；可直接「加入购物车」下单，数量按斤计（1 份=1 斤），门店备货称重复核。
              </Text>
            </View>

            {/* 分类入口（带辅助小图，前端基于已返回 fresh 商品过滤，不写 DB） */}
            <View style={{ display: 'flex', gap: '14rpx', flexWrap: 'wrap' }}>
              {['全部', '野生海鱼', '鲜虾贝蚝', '章鱼鱿鱼', '石斑贵价鱼', '杂鱼/其它'].map((c) => {
                const active = freshCategory === c;
                const thumb = FRESH_CATEGORY_THUMBS[c];
                return (
                  <View
                    key={c}
                    onClick={() => setFreshCategory(c)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10rpx',
                      padding: thumb ? '6rpx 18rpx 6rpx 6rpx' : '12rpx 22rpx',
                      borderRadius: '999rpx',
                      background: active ? '#2f7f91' : '#ffffff',
                      border: active ? '2rpx solid #2f7f91' : '2rpx solid #bfdcd6',
                      boxShadow: active ? '0 6rpx 16rpx rgba(107,150,162,0.22)' : 'none'
                    }}
                  >
                    {thumb ? (
                      <Image src={thumb} mode='aspectFill' style={{ width: '52rpx', height: '52rpx', borderRadius: '999rpx', border: '2rpx solid rgba(255,255,255,0.8)' }} />
                    ) : null}
                    <Text style={{ fontSize: '24rpx', fontWeight: '700', color: active ? '#ffffff' : '#263f48' }}>{c}</Text>
                  </View>
                );
              })}
            </View>

            {(() => {
              const shown = freshItems.filter((it) => freshCategory === '全部' || it.category === freshCategory);
              if (shown.length === 0) {
                return (
                  <View style={{ background: '#e7f5f2', borderRadius: '20rpx', padding: '40rpx', textAlign: 'center', border: '2rpx solid #bfdcd6' }}>
                    <Text style={{ fontSize: '26rpx', color: '#6e8791' }}>该分类暂无今日到货</Text>
                  </View>
                );
              }
              return (
                <View style={{ display: 'flex', flexDirection: 'column', gap: '18rpx' }}>
                  <Text style={{ fontSize: '24rpx', color: '#6e8791' }}>当前分类 {shown.length} 款 · 共 {freshItems.length} 款</Text>
                  {shown.map((item) => (
                    <View
                      key={item.id}
                      onClick={() => openFreshSheet(item)}
                      style={{ background: '#ffffff', borderRadius: '24rpx', padding: '22rpx', border: '2rpx solid #bfdcd6', boxShadow: '0 12rpx 28rpx rgba(47,127,145,0.12)', borderLeft: '10rpx solid #2f8da1' }}
                    >
                      {/* Phase 2.49L-a：鲜鱼封面——优先 coverImageUrl，缺失用统一 fresh 占位图；绝不用干货/汤料图。 */}
                      <Image
                        className='product-cover-image'
                        src={getFreshProductCover(item.coverImageUrl)}
                        mode='aspectFill'
                        style={{ width: '100%', height: '300rpx', borderRadius: '18rpx', marginBottom: '14rpx', background: '#eef7f7' }}
                      />
                      <View style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10rpx' }}>
                        <Text style={{ fontSize: '32rpx', fontWeight: '800', color: '#263f48' }}>{item.name}</Text>
                        {item.category ? (
                          <View style={{ padding: '6rpx 14rpx', borderRadius: '999rpx', background: '#e7f5f2', border: '2rpx solid #bfdcd6' }}>
                            <Text style={{ fontSize: '21rpx', color: '#557079', fontWeight: '700' }}>{item.category}</Text>
                          </View>
                        ) : null}
                      </View>
                      {/* Phase 2.51B：售价/斤（直购，按斤计价） */}
                      <View style={{ display: 'flex', alignItems: 'baseline', gap: '12rpx', marginBottom: '8rpx' }}>
                        <Text style={{ fontSize: '36rpx', fontWeight: '900', color: '#2f7f91' }}>
                          {item.referencePriceCents != null ? `售价 ¥${(item.referencePriceCents / 100).toFixed(0)}/斤` : item.displayPriceLabel}
                        </Text>
                      </View>
                      <Text style={{ display: 'block', fontSize: '22rpx', color: '#6e8791', marginBottom: '14rpx' }}>{item.saleHint}</Text>
                      <View style={{ display: 'flex', gap: '10rpx', flexWrap: 'wrap', marginBottom: '16rpx' }}>
                        <View style={{ display: 'flex', alignItems: 'center', gap: '6rpx', padding: '6rpx 14rpx', borderRadius: '999rpx', background: '#e1f2ee' }}>
                          <Image src={iconMarketPrice} mode='aspectFit' style={{ width: '26rpx', height: '26rpx' }} />
                          <Text style={{ fontSize: '22rpx', color: '#2e7568', fontWeight: '700' }}>{item.suggestedDisplayTag}</Text>
                        </View>
                        <View style={{ display: 'flex', alignItems: 'center', gap: '6rpx', padding: '6rpx 14rpx', borderRadius: '999rpx', background: '#e1f2ee' }}>
                          <Image src={iconInstoreWeighing} mode='aspectFit' style={{ width: '26rpx', height: '26rpx' }} />
                          <Text style={{ fontSize: '22rpx', color: '#2e7568', fontWeight: '700' }}>到店称重</Text>
                        </View>
                      </View>
                      {/* Phase 2.51B：加入购物车（直购，按斤计价），走普通结算/支付 */}
                      <Button
                        className='ui-pressable'
                        hoverClass='ui-pressable-hover'
                        size='mini'
                        style={{ background: 'linear-gradient(135deg,#2f7f91,#256d7e)', color: '#ffffff', borderRadius: '999rpx', minWidth: '210rpx', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8rpx' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          openFreshSheet(item);
                        }}
                      >
                        <Image src={iconAddReservation} mode='aspectFit' style={{ width: '30rpx', height: '30rpx' }} />
                        加入购物车 · 按斤计价
                      </Button>
                    </View>
                  ))}
                </View>
              );
            })()}
          </View>
        )
      ) : null}

      {channel === 'dry' ? (
      <View style={{ display: 'flex', flexDirection: 'column' }}>
      <View className='brand-trust-card' style={{ marginBottom: '24rpx' }}>
        <View style={{ display: 'flex', justifyContent: 'space-between', gap: '18rpx', alignItems: 'center', marginBottom: '18rpx' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ display: 'block', fontSize: '28rpx', color: '#236b45', fontWeight: '800', marginBottom: '6rpx' }}>
              广州连锁门店为你服务
            </Text>
            <Text style={{ display: 'block', fontSize: '24rpx', color: '#6b7280' }}>
              到店自提更安心，邮寄发货更方便。
            </Text>
          </View>
          <View
            style={{
              padding: '8rpx 16rpx',
              borderRadius: '999rpx',
              background: '#eaf6ee',
              border: '2rpx solid #d8ead9'
            }}
          >
            <Text style={{ fontSize: '22rpx', color: '#236b45', fontWeight: '700' }}>广州 6 店</Text>
          </View>
        </View>
        <View className='brand-trust-points'>
          {SERVICE_ENTRIES.map((entry) => (
            <View className='brand-trust-point' key={entry.label}>
              <Image className='brand-trust-icon' src={entry.image} mode='aspectFill' />
              <Text>{entry.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className='brand-curation-strip' style={{ marginBottom: '24rpx' }}>
        <Image className='brand-curation-image' src={emptyOrderImage} mode='aspectFill' />
        <View style={{ flex: 1 }}>
          <Text style={{ display: 'block', fontSize: '28rpx', fontWeight: '800', color: '#17231c', marginBottom: '6rpx' }}>
            新中式滋补严选
          </Text>
          <Text style={{ display: 'block', fontSize: '23rpx', color: '#6b7280' }}>
            从门店到餐桌，照顾日常煲汤与节礼囤货。
          </Text>
        </View>
      </View>

      <View className='commerce-filter-card'>
        <View className='commerce-search-row'>
          <Input
            className='commerce-search-input'
            type='text'
            placeholder='搜索商品、汤料或规格'
            value={searchInput}
            onInput={(event) => setSearchInput(event.detail.value)}
            confirmType='search'
            onConfirm={() => setSearchKeyword(searchInput.trim())}
          />
          <Button
            className='ui-pressable ui-primary-button commerce-search-button'
            hoverClass='ui-pressable-hover'
            size='mini'
            type='primary'
            onClick={() => setSearchKeyword(searchInput.trim())}
          >
            搜索
          </Button>
        </View>
        {searchKeyword ? (
          <View className='commerce-search-summary'>
            <Text>正在搜索：{searchKeyword}</Text>
            <Button
              className='ui-pressable commerce-clear-button'
              hoverClass='ui-pressable-hover'
              size='mini'
              onClick={() => {
                setSearchInput('');
                setSearchKeyword('');
              }}
            >
              清空
            </Button>
          </View>
        ) : null}
        <View className='commerce-category-row'>
          {PRODUCT_CATEGORIES.map((category) => {
            const categoryIcon = getCategoryIcon(category);

            return (
              <View
                key={category}
                className={`commerce-category-pill ${activeCategory === category ? 'commerce-category-pill-active' : ''}`}
                onClick={() => setActiveCategory(category)}
              >
                {categoryIcon ? <Image className='commerce-category-icon' src={categoryIcon} mode='aspectFit' /> : null}
                <Text>{category}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {loading ? (
        <View className='ui-skeleton-card'>
          <Text style={{ display: 'block', fontSize: '28rpx', fontWeight: '600', color: '#17231c', marginBottom: '20rpx' }}>
            正在加载商品…
          </Text>
          <View className='ui-skeleton-block' style={{ marginBottom: '24rpx' }} />
          <View className='ui-skeleton-line' style={{ width: '70%', marginBottom: '16rpx' }} />
          <View className='ui-skeleton-line' style={{ width: '92%', marginBottom: '22rpx' }} />
          <View style={{ display: 'flex', gap: '14rpx' }}>
            <View className='ui-skeleton-pill' style={{ width: '160rpx' }} />
            <View className='ui-skeleton-pill' style={{ width: '180rpx' }} />
          </View>
        </View>
      ) : error ? (
        <View
          style={{
            background: '#fdecec',
            borderRadius: '24rpx',
            padding: '28rpx',
            border: '2rpx solid #f6c7c7',
            boxShadow: '0 8rpx 24rpx rgba(159, 42, 29, 0.06)'
          }}
        >
          <Text style={{ display: 'block', fontSize: '30rpx', fontWeight: '600', marginBottom: '12rpx' }}>商品加载失败</Text>
          <Text style={{ display: 'block', fontSize: '26rpx', color: '#9f2a1d', marginBottom: '20rpx' }}>{error}</Text>
          <Button className='ui-pressable ui-primary-button' hoverClass='ui-pressable-hover' size='mini' type='primary' onClick={loadProducts}>
            重试
          </Button>
        </View>
      ) : products.length === 0 ? (
        <View className='brand-empty-card'>
          <Image className='brand-empty-image' src={emptyOrderImage} mode='aspectFill' />
          <Text style={{ display: 'block', fontSize: '32rpx', fontWeight: '700', color: '#17231c', marginBottom: '10rpx' }}>
            暂无可售商品
          </Text>
          <Text style={{ display: 'block', fontSize: '26rpx', color: '#6b7280', marginBottom: '22rpx' }}>
            暂时没有可售商品，请稍后再来或联系商家。
          </Text>
        </View>
      ) : (
        <View style={{ display: 'flex', flexDirection: 'column', gap: '22rpx' }}>
          <View style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: '26rpx', color: '#6b7280' }}>当前可选 {products.length} 款</Text>
            <Text style={{ fontSize: '28rpx', color: '#236b45', fontWeight: '800' }}>本店精选</Text>
          </View>

          {products.map((product) => {
            const artwork = getProductArtwork(product.name);

            return (
            <View
              key={product.id}
              className='ui-card-pressable product-card product-card-brand'
              hoverClass='ui-card-pressable-hover'
              style={{
                background: '#ffffff',
                borderRadius: '24rpx',
                padding: '18rpx 18rpx 28rpx',
                boxShadow: '0 12rpx 30rpx rgba(23, 35, 28, 0.08)',
                border: '2rpx solid #e8e0d3'
              }}
            >
              <View
                className='product-cover-panel'
                onClick={() => {
                  Taro.navigateTo({
                    url: `/pages/product-detail/index?productId=${product.id}`
                  });
                }}
              >
                <Image className='product-cover-image' src={artwork.coverSrc} mode='aspectFill' />
                <View className='product-cover-badge'>
                  <Text>绿膳荟严选</Text>
                </View>
              </View>

              <View style={{ display: 'flex', gap: '10rpx', flexWrap: 'wrap', marginBottom: '14rpx' }}>
                {getFulfillmentLabels(product).map((label) => (
                  <View
                    key={label}
                    style={{
                      padding: '6rpx 14rpx',
                      borderRadius: '999rpx',
                      background: label === '暂未开放' ? '#f6f1e8' : '#eaf6ee'
                    }}
                  >
                    <Text style={{ fontSize: '22rpx', color: label === '暂未开放' ? '#6b7280' : '#236b45', fontWeight: '700' }}>
                      {label}
                    </Text>
                  </View>
                ))}
              </View>

              <Text style={{ display: 'block', fontSize: '34rpx', fontWeight: '800', marginBottom: '10rpx', color: '#17231c' }}>
                {sanitizeProductDisplayName(product.name)}
              </Text>
              <Text style={{ display: 'block', fontSize: '26rpx', color: '#6b7280', marginBottom: '12rpx' }}>
                {product.description?.trim() || '精选海味干货，适合家庭囤货与日常烹饪。'}
              </Text>
              <Text style={{ display: 'block', fontSize: '24rpx', color: '#c98b3c', marginBottom: '18rpx', fontWeight: '700' }}>
                规格：{getSkuSummary(product)}
              </Text>

              <View
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '28rpx',
                  paddingTop: '4rpx'
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ display: 'block', fontSize: '24rpx', color: '#6b7280' }}>到手价</Text>
                  <Text style={{ display: 'block', fontSize: '34rpx', fontWeight: '800', color: '#d94836' }}>
                    {getStartingPrice(product)}
                  </Text>
                </View>

                <Button
                  className='ui-pressable ui-primary-button'
                  hoverClass='ui-pressable-hover'
                  size='mini'
                  type='primary'
                  style={{ minWidth: '150rpx', height: '64rpx', lineHeight: '64rpx', borderRadius: '999rpx' }}
                  disabled={product.skus.length === 0 || getProductAvailableStock(product) <= 0}
                  onClick={() => openSkuSheet(product)}
                >
                  {getProductAvailableStock(product) > 0 ? '选规格' : '暂时缺货'}
                </Button>
              </View>
            </View>
            );
          })}
        </View>
      )}

      </View>
      ) : null}

      {skuSheetProduct ? (
        <RootPortal>
          <View className='sku-sheet-mask' catchMove onClick={closeSkuSheet}>
            <View className='sku-sheet-panel' onClick={(event) => event.stopPropagation()} onTouchMove={(event) => event.stopPropagation()}>
              <View className='sku-sheet-handle' />
              <View className='sku-sheet-header'>
                <Image className='sku-sheet-image' src={getProductArtwork(skuSheetProduct.name).coverSrc} mode='aspectFill' />
                <View className='sku-sheet-header-copy'>
                  <Text className='sku-sheet-kicker'>绿膳荟严选</Text>
                  <Text className='sku-sheet-title'>{skuSheetProduct.name}</Text>
                  <Text className='sku-sheet-price'>{getPriceRange(skuSheetProduct)}</Text>
                  <Text className='sku-sheet-stock'>当前可售约 {getProductAvailableStock(skuSheetProduct)} 件</Text>
                </View>
              </View>

              <View className='sku-sheet-section'>
                <Text className='sku-sheet-section-title'>选择规格</Text>
                <View className='sku-option-list'>
                  {skuSheetProduct.skus.map((sku) => {
                    const stock = getSkuAvailableStock(sku);
                    const isSelected = selectedSheetSku?.id === sku.id;
                    const isDisabled = stock <= 0;

                    return (
                      <View
                        key={sku.id}
                        className={`sku-option-card ${isSelected ? 'sku-option-card-active' : ''} ${isDisabled ? 'sku-option-card-disabled' : ''}`}
                        onClick={() => {
                          if (isDisabled) return;
                          setSheetSkuId(sku.id);
                          setSheetQty(1);
                        }}
                      >
                        <View>
                          <Text className='sku-option-name'>{sku.name}</Text>
                          <Text className='sku-option-stock'>{isDisabled ? '当前规格库存不足' : `可售约 ${stock} 件`}</Text>
                        </View>
                        <Text className='sku-option-price'>{formatPriceCents(sku.memberPriceCents || sku.priceCents)}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              <View className='sku-sheet-section'>
                <Text className='sku-sheet-section-title'>购买数量</Text>
                <View className='sku-quantity-row'>
                  <Button
                    className='cart-quantity-button ui-pressable'
                    hoverClass='ui-pressable-hover'
                    size='mini'
                    disabled={sheetQty <= 1}
                    onClick={() => setSheetQty((current) => Math.max(1, current - 1))}
                  >
                    -
                  </Button>
                  <Text className='cart-quantity-value'>{sheetQty}</Text>
                  <Button
                    className='cart-quantity-button ui-pressable'
                    hoverClass='ui-pressable-hover'
                    size='mini'
                    disabled={!selectedSheetSku || sheetQty >= getSkuAvailableStock(selectedSheetSku)}
                    onClick={() => setSheetQty((current) => current + 1)}
                  >
                    +
                  </Button>
                </View>
              </View>

              <View className='sku-sheet-actions'>
                <Button
                  className='ui-pressable'
                  hoverClass='ui-pressable-hover'
                  style={{ flex: 1 }}
                  disabled={cartSubmitting || !selectedSheetSku}
                  loading={cartSubmitting}
                  onClick={handleAddToCart}
                >
                  {cartSubmitting ? '加入中' : '加入购物车'}
                </Button>
                <Button
                  className='ui-pressable ui-primary-button'
                  hoverClass='ui-pressable-hover'
                  style={{ flex: 1 }}
                  type='primary'
                  disabled={!selectedSheetSku}
                  onClick={handleBuyNow}
                >
                  立即购买
                </Button>
              </View>
            </View>
          </View>
        </RootPortal>
      ) : null}

      {/* Phase 2.51E：鲜鱼规格购买底部弹窗（复用干货弹窗视觉；鲜鱼单规格按斤、fresh 真图） */}
      {freshSheetItem ? (
        <RootPortal>
          <View className='sku-sheet-mask' catchMove onClick={closeFreshSheet}>
            <View className='sku-sheet-panel sku-sheet-panel--fresh' onClick={(event) => event.stopPropagation()} onTouchMove={(event) => event.stopPropagation()}>
              <View className='sku-sheet-handle' />
              <View className='sku-sheet-header'>
                <Image className='sku-sheet-image' src={getFreshProductCover(freshSheetItem.coverImageUrl)} mode='aspectFill' />
                <View className='sku-sheet-header-copy'>
                  <Text className='sku-sheet-kicker'>今日新鲜渔产</Text>
                  <Text className='sku-sheet-title'>{freshSheetItem.name}</Text>
                  <Text className='sku-sheet-price'>{freshSheetItem.referencePriceCents != null ? `售价 ¥${(freshSheetItem.referencePriceCents / 100).toFixed(0)}/斤` : freshSheetItem.displayPriceLabel}</Text>
                  <Text className='sku-sheet-stock'>今日到货 · 现货可下单</Text>
                </View>
              </View>

              <View className='sku-sheet-section'>
                <Text className='sku-sheet-section-title'>选择规格</Text>
                <View className='sku-option-list'>
                  <View className='sku-option-card sku-option-card-active'>
                    <View>
                      <Text className='sku-option-name'>{freshSheetItem.name}（单位：斤）</Text>
                      <Text className='sku-option-stock'>数量按斤计（1 份 = 1 斤）</Text>
                    </View>
                    <Text className='sku-option-price'>{freshSheetItem.referencePriceCents != null ? `¥${(freshSheetItem.referencePriceCents / 100).toFixed(0)}/斤` : freshSheetItem.displayPriceLabel}</Text>
                  </View>
                </View>
              </View>

              <View className='sku-sheet-section'>
                <Text className='sku-sheet-section-title'>购买数量</Text>
                <View className='sku-quantity-row'>
                  <Button className='cart-quantity-button ui-pressable' hoverClass='ui-pressable-hover' size='mini' disabled={freshSheetQty <= 1} onClick={() => setFreshSheetQty((c) => Math.max(1, c - 1))}>
                    -
                  </Button>
                  <Text className='cart-quantity-value'>{freshSheetQty}</Text>
                  <Button className='cart-quantity-button ui-pressable' hoverClass='ui-pressable-hover' size='mini' disabled={freshSheetQty >= 99} onClick={() => setFreshSheetQty((c) => c + 1)}>
                    +
                  </Button>
                </View>
                <Text style={{ display: 'block', fontSize: '22rpx', color: '#6e8791', marginTop: '8rpx' }}>数量按斤计，1 份 = 1 斤；门店备货称重复核。</Text>
              </View>

              <View className='sku-sheet-actions'>
                <Button className='ui-pressable fresh-sku-secondary' hoverClass='ui-pressable-hover' style={{ flex: 1 }} disabled={cartSubmitting} loading={cartSubmitting} onClick={handleFreshSheetAddToCart}>
                  {cartSubmitting ? '加入中' : '加入购物车'}
                </Button>
                <Button className='ui-pressable ui-primary-button fresh-sku-primary' hoverClass='ui-pressable-hover' style={{ flex: 1 }} type='primary' disabled={cartSubmitting} onClick={handleFreshSheetBuyNow}>
                  立即购买
                </Button>
              </View>
            </View>
          </View>
        </RootPortal>
      ) : null}
    </View>
  );
}
