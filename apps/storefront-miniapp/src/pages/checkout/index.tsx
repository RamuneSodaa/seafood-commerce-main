import { useEffect, useMemo, useState } from 'react';
import Taro, { useRouter } from '@tarojs/taro';
import { Button, Image, Input, RootPortal, Text, View } from '@tarojs/components';

import homeHeroImage from '../../assets/brand/home-hero.jpg';
import { getProductArtwork } from '../../lib/product-artwork';
import { sanitizeProductDisplayName } from '../../lib/product-display-name';
import serviceStoreImage from '../../assets/brand/service-store.jpg';
import {
  createAuthenticatedOrder,
  createOrder,
  clearCartItems,
  getMyCoupons,
  getCart,
  getAuthenticatedOrders,
  getAuthenticatedCustomerAddresses,
  getCustomerAddresses,
  getProduct,
  getProducts,
  getStores,
  previewAuthenticatedOrderQuote,
  previewOrderQuote,
  type CartSummary,
  type CreateOrderPayload,
  type CustomerCoupon,
  type CustomerAddress,
  type FulfillmentType,
  type OrderQuotePreview,
  type ProductDetail,
  type ProductSku,
  type ProductSummary,
  type StoreSummary
} from '../../lib/api';
import { redirectToCustomerLogin } from '../../lib/customer-login-redirect';
import { getMiniappIdentitySource } from '../../lib/identity';
import { getStoredCustomerAuthArtifact } from '../../lib/identity-storage';

type ShippingAddressForm = NonNullable<CreateOrderPayload['shippingAddress']> & {
  postalCode: string;
};

type CheckoutLine = {
  id: string;
  productId: string;
  productName: string;
  skuId: string;
  skuName: string;
  quantity: number;
  unitPriceCents: number;
  lineAmountCents: number;
};

type CouponApplyMode = 'NONE' | 'USER_COUPON' | 'CODE';

type AddonRecommendation = {
  productId: string;
  productName: string;
  sku: ProductSku;
  unitPriceCents: number;
  availableStock: number;
  coverSrc: string;
};

const EMPTY_SHIPPING_ADDRESS: ShippingAddressForm = {
  receiverName: '',
  phone: '',
  province: '',
  city: '',
  district: '',
  detail: '',
  postalCode: ''
};

function getCheckoutSubmitErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message === 'Invalid coupon code') {
    return '优惠码无效，请检查后重试。';
  }

  if (error instanceof Error && /优惠码不存在|优惠码无效|优惠码.*未领取/.test(error.message)) {
    return '兑换码无效，请检查后重试。';
  }

  if (error instanceof Error && /[\u4e00-\u9fa5]/.test(error.message)) {
    return error.message;
  }

  return '订单提交失败，请稍后重试。';
}

function isShippingAddressBlank(address: ShippingAddressForm): boolean {
  return !address.receiverName.trim() &&
    !address.phone.trim() &&
    !address.province.trim() &&
    !address.city.trim() &&
    !address.district.trim() &&
    !address.detail.trim() &&
    !address.postalCode.trim();
}

function formatPriceCents(amountCents: number): string {
  const value = (Number(amountCents) || 0) / 100;
  return `¥${value.toFixed(2)}`;
}

function getFulfillmentLabel(type: FulfillmentType): string {
  return type === 'STORE_PICKUP' ? '到店自提' : '邮寄发货';
}


function getSkuAvailableStock(sku: ProductSku | null | undefined): number {
  return Math.max(0, sku?.availableStock || 0);
}

function shouldUseProtectedCheckoutOrderCreate(): boolean {
  return getMiniappIdentitySource() === 'real-storage';
}

function shouldUseProtectedCheckoutAddressRead(): boolean {
  return getMiniappIdentitySource() === 'real-storage';
}

function getCheckoutLoginRedirectTarget(params: { productId?: string; skuId?: string; qty?: string; cartItemIds?: string }): string {
  const query: string[] = [];

  if (params.productId) {
    query.push(`productId=${params.productId}`);
  }

  if (params.skuId) {
    query.push(`skuId=${params.skuId}`);
  }

  if (params.qty) {
    query.push(`qty=${params.qty}`);
  }

  if (params.cartItemIds) {
    query.push(`cartItemIds=${encodeURIComponent(params.cartItemIds)}`);
  }

  return `/pages/checkout/index?${query.join('&')}`;
}

function normalizeStores(value: StoreSummary[] | null | undefined): StoreSummary[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((store) => Boolean(store?.id && store?.name && store?.address));
}

function normalizeAddresses(value: CustomerAddress[] | null | undefined): CustomerAddress[] {
  return Array.isArray(value) ? value : [];
}

function normalizeQuotePreview(value: OrderQuotePreview | null | undefined): OrderQuotePreview | null {
  if (
    !value ||
    typeof value.subtotalAmountCents !== 'number' ||
    typeof value.discountAmountCents !== 'number' ||
    typeof value.totalAmountCents !== 'number'
  ) {
    return null;
  }

  return {
    subtotalAmountCents: value.subtotalAmountCents,
    baseAmountCents: typeof value.baseAmountCents === 'number' ? value.baseAmountCents : value.subtotalAmountCents,
    memberDiscountAmountCents: typeof value.memberDiscountAmountCents === 'number' ? value.memberDiscountAmountCents : 0,
    couponDiscountAmountCents: typeof value.couponDiscountAmountCents === 'number' ? value.couponDiscountAmountCents : value.discountAmountCents,
    discountAmountCents: value.discountAmountCents,
    totalAmountCents: value.totalAmountCents,
    appliedCouponCode: typeof value.appliedCouponCode === 'string' ? value.appliedCouponCode : null,
    appliedUserCouponId: typeof value.appliedUserCouponId === 'string' ? value.appliedUserCouponId : null,
    appliedCouponCodes: Array.isArray(value.appliedCouponCodes) ? value.appliedCouponCodes : [],
    appliedUserCouponIds: Array.isArray(value.appliedUserCouponIds) ? value.appliedUserCouponIds : [],
    couponApplications: Array.isArray(value.couponApplications) ? value.couponApplications : [],
    adjustments: Array.isArray(value.adjustments) ? value.adjustments : []
  };
}

function parseCartItemIds(value: string): string[] {
  if (!value.trim()) {
    return [];
  }

  try {
    return decodeURIComponent(value)
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  } catch {
    return value
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  }
}

export default function CheckoutPage() {
  const router = useRouter();
  const productId = router.params?.productId || '';
  const presetSkuId = router.params?.skuId || '';
  const presetQty = Math.max(1, Number(router.params?.qty || 1) || 1);
  const cartItemIdsParam = router.params?.cartItemIds || '';
  const cartItemIds = useMemo(
    () => parseCartItemIds(cartItemIdsParam),
    [cartItemIdsParam]
  );
  const isCartCheckout = cartItemIds.length > 0;

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [cartCheckout, setCartCheckout] = useState<CartSummary | null>(null);
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [storeId, setStoreId] = useState('');
  const [skuId, setSkuId] = useState(presetSkuId);
  const [qty, setQty] = useState(presetQty);
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>('STORE_PICKUP');
  const [shippingAddress, setShippingAddress] = useState<ShippingAddressForm>(EMPTY_SHIPPING_ADDRESS);
  const [couponCode, setCouponCode] = useState('');
  const [couponApplyMode, setCouponApplyMode] = useState<CouponApplyMode>('NONE');
  const [accountCoupons, setAccountCoupons] = useState<CustomerCoupon[]>([]);
  const [selectedUserCouponIds, setSelectedUserCouponIds] = useState<string[]>([]);
  const [couponCodeFeedback, setCouponCodeFeedback] = useState('');
  const [couponCodeFeedbackType, setCouponCodeFeedbackType] = useState<'idle' | 'success' | 'error'>('idle');
  const [defaultAddress, setDefaultAddress] = useState<CustomerAddress | null>(null);
  const [hasTouchedShippingAddress, setHasTouchedShippingAddress] = useState(false);
  const [loading, setLoading] = useState(true);
  const [addressBookLoading, setAddressBookLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [quotePreview, setQuotePreview] = useState<OrderQuotePreview | null>(null);
  const [quoteError, setQuoteError] = useState('');
  const [addonItems, setAddonItems] = useState<CheckoutLine[]>([]);
  const [addonSheetOpen, setAddonSheetOpen] = useState(false);
  const [addonLoading, setAddonLoading] = useState(false);
  const [addonRecommendations, setAddonRecommendations] = useState<AddonRecommendation[]>([]);

  useEffect(() => {
    if (!productId && !isCartCheckout) {
      setLoading(false);
      return;
    }

    let isActive = true;

    async function loadPage() {
      setLoading(true);
      setError('');

      try {
        const usesProtectedAddressRead = shouldUseProtectedCheckoutAddressRead();
        const storedAuthArtifact = getStoredCustomerAuthArtifact();

        if ((usesProtectedAddressRead || isCartCheckout) && !storedAuthArtifact) {
          redirectToCustomerLogin(getCheckoutLoginRedirectTarget({
            productId,
            skuId: presetSkuId,
            qty: String(presetQty),
            cartItemIds: cartItemIdsParam
          }));
          return;
        }

        const [primaryData, addressesData] = await Promise.all([
          isCartCheckout ? getCart() : getProduct(productId),
          usesProtectedAddressRead ? getAuthenticatedCustomerAddresses() : getCustomerAddresses()
        ]);

        if (!isActive) return;

        const normalizedAddresses = normalizeAddresses(addressesData);
        setDefaultAddress(normalizedAddresses.find((address) => address.isDefault) || null);

        if (isCartCheckout) {
          const cartData = primaryData as CartSummary;
          const selectedIds = new Set(cartItemIds);
          const selectedItems = cartData.items.filter((item) => selectedIds.has(item.id));
          const selectedCartData: CartSummary = {
            ...cartData,
            items: selectedItems,
            itemCount: selectedItems.reduce((sum, item) => sum + item.quantity, 0),
            subtotalAmountCents: selectedItems.reduce((sum, item) => sum + item.lineAmountCents, 0)
          };
          const normalizedStores = normalizeStores(cartData.availableStores);

          setProduct(null);
          setCartCheckout(selectedCartData);
          setStores(normalizedStores);
          setStoreId((current) => (
            normalizedStores.some((store) => store.id === current) ? current : normalizedStores[0]?.id || ''
          ));
          setSkuId('');
          setQty(1);

          const supportsPickup = selectedItems.every((item) => item.product.supportsPickup !== false);
          const supportsShipping = selectedItems.every((item) => item.product.supportsShipping !== false);

          if (!supportsPickup && supportsShipping) {
            setFulfillmentType('SHIPPING');
          }

          if (!supportsShipping && supportsPickup) {
            setFulfillmentType('STORE_PICKUP');
          }
        } else {
          const productData = primaryData as ProductDetail;
          const resolvedSkuId = presetSkuId || productData.skus[0]?.id || '';
          const storesData = resolvedSkuId ? await getStores({ skuId: resolvedSkuId }) : [];
          const normalizedStores = normalizeStores(storesData);

          if (!isActive) return;

          setProduct(productData);
          setCartCheckout(null);
          setStores(normalizedStores);
          setStoreId((current) => (
            normalizedStores.some((store) => store.id === current) ? current : normalizedStores[0]?.id || ''
          ));
          setSkuId((current) => current || resolvedSkuId);
          setQty(presetQty);

          if (!productData.supportsPickup && productData.supportsShipping) {
            setFulfillmentType('SHIPPING');
          }

          if (!productData.supportsShipping && productData.supportsPickup) {
            setFulfillmentType('STORE_PICKUP');
          }
        }
      } catch (e) {
        if (isActive) {
          setError(getCheckoutSubmitErrorMessage(e));
        }
      } finally {
        if (isActive) {
          setLoading(false);
          setAddressBookLoading(false);
        }
      }
    }

    loadPage();

    return () => {
      isActive = false;
    };
  }, [cartItemIdsParam, isCartCheckout, presetQty, presetSkuId, productId]);

  useEffect(() => {
    if (fulfillmentType !== 'SHIPPING') return;
    if (!defaultAddress) return;
    if (hasTouchedShippingAddress) return;

    setShippingAddress((current) => {
      if (!isShippingAddressBlank(current)) return current;

      return {
        receiverName: defaultAddress.receiverName,
        phone: defaultAddress.phone,
        province: defaultAddress.province,
        city: defaultAddress.city,
        district: defaultAddress.district,
        detail: defaultAddress.detail,
        postalCode: defaultAddress.postalCode || ''
      };
    });
  }, [defaultAddress, fulfillmentType, hasTouchedShippingAddress]);

  const activeSku = useMemo(
    () => product?.skus.find((sku) => sku.id === skuId) ?? product?.skus[0] ?? null,
    [product, skuId]
  );

  const selectedCartItems = useMemo(
    () => cartCheckout?.items.filter((item) => cartItemIds.includes(item.id)) || [],
    [cartCheckout, cartItemIds]
  );

  const checkoutItems = useMemo<CheckoutLine[]>(() => {
    let baseItems: CheckoutLine[] = [];

    if (isCartCheckout) {
      baseItems = selectedCartItems.map((item) => ({
        id: item.id,
        productId: item.product.id,
        productName: item.product.name,
        skuId: item.sku.id,
        skuName: item.sku.name,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        lineAmountCents: item.lineAmountCents
      }));
    } else if (product && activeSku) {
      baseItems = [{
        id: activeSku.id,
        productId: product.id,
        productName: product.name,
        skuId: activeSku.id,
        skuName: activeSku.name,
        quantity: qty,
        unitPriceCents: activeSku.memberPriceCents || activeSku.priceCents,
        lineAmountCents: (activeSku.memberPriceCents || activeSku.priceCents) * qty
      }];
    }

    return [...baseItems, ...addonItems];
  }, [activeSku, addonItems, isCartCheckout, product, qty, selectedCartItems]);

  const trimmedShippingAddress = useMemo(
    () => ({
      receiverName: shippingAddress.receiverName.trim(),
      phone: shippingAddress.phone.trim(),
      province: shippingAddress.province.trim(),
      city: shippingAddress.city.trim(),
      district: shippingAddress.district.trim(),
      detail: shippingAddress.detail.trim(),
      postalCode: shippingAddress.postalCode.trim()
    }),
    [shippingAddress]
  );

  const missingShippingFields = useMemo(() => {
    const missing: string[] = [];

    if (!trimmedShippingAddress.receiverName) missing.push('收货人');
    if (!trimmedShippingAddress.phone) missing.push('联系电话');
    if (!trimmedShippingAddress.province) missing.push('省');
    if (!trimmedShippingAddress.city) missing.push('市');
    if (!trimmedShippingAddress.district) missing.push('区 / 区县');
    if (!trimmedShippingAddress.detail) missing.push('详细地址');

    return missing;
  }, [trimmedShippingAddress]);

  const hasCompleteShippingAddress = missingShippingFields.length === 0;
  const trimmedCouponCode = couponCode.trim();
  const totalAmountCents = checkoutItems.reduce((sum, item) => sum + item.lineAmountCents, 0);
  const payableAmountCents = quotePreview?.totalAmountCents ?? totalAmountCents;
  const selectedCouponIdsKey = selectedUserCouponIds.join(',');
  const selectedCoupons = accountCoupons.filter((coupon) => coupon.id && selectedUserCouponIds.includes(coupon.id));
  const selectedCouponNames = selectedCoupons.map((coupon) => coupon.name).join('、');
  const couponBaseAmountCents = quotePreview
    ? quotePreview.subtotalAmountCents - (quotePreview.memberDiscountAmountCents || 0)
    : totalAmountCents;
  const selectedStore = stores.find((store) => store.id === storeId) ?? null;
  const firstCheckoutItem = checkoutItems[0] || null;
  const supportsPickup = isCartCheckout
    ? selectedCartItems.every((item) => item.product.supportsPickup !== false)
    : product?.supportsPickup !== false;
  const supportsShipping = isCartCheckout
    ? selectedCartItems.every((item) => item.product.supportsShipping !== false)
    : product?.supportsShipping !== false;
  const canSubmit = Boolean(
    checkoutItems.length > 0 &&
      storeId &&
      !submitting &&
      (fulfillmentType === 'STORE_PICKUP' || hasCompleteShippingAddress)
  );

  useEffect(() => {
    setQuotePreview(null);
    setQuoteError('');
  }, [storeId, checkoutItems, fulfillmentType, trimmedCouponCode, selectedCouponIdsKey]);

  useEffect(() => {
    if (loading) return;
    if (!getStoredCustomerAuthArtifact()) return;

    let isActive = true;

    loadAccountCoupons().then((coupons) => {
      if (!isActive) return;
      setAccountCoupons(coupons);
    }).catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, [loading]);

  async function loadAccountCoupons() {
    try {
      const coupons = await getMyCoupons();
      return coupons.filter((coupon) => Boolean(coupon.id));
    } catch (e) {
      console.warn('优惠券账户读取失败', e);
      return [];
    }
  }

  async function refreshAccountCoupons() {
    const coupons = await loadAccountCoupons();
    setAccountCoupons(coupons);
    Taro.showToast({
      title: '优惠券已刷新',
      icon: 'success'
    });
  }

  function getCouponDiscountText(coupon: CustomerCoupon): string {
    if (coupon.discountType === 'PERCENT_OFF' && coupon.discountPercent) {
      return `${coupon.discountPercent} 折`;
    }

    return `-${formatPriceCents(coupon.discountAmountCents || 0)}`;
  }

  function getCouponUseHint(coupon: CustomerCoupon): string {
    if (coupon.thresholdAmountCents > 0) {
      return `满 ${formatPriceCents(coupon.thresholdAmountCents)} 可用`;
    }

    return '无门槛可用';
  }

  function getCouponUnavailableReason(coupon: CustomerCoupon): string {
    if (coupon.status === 'LOCKED') {
      return '已用于待支付订单，取消该订单后可释放';
    }

    if (coupon.status === 'USED') {
      return '已使用';
    }

    if (coupon.status === 'EXPIRED') {
      return '已过期';
    }

    if (coupon.status === 'VOID') {
      return '已作废';
    }

    if (coupon.status && coupon.status !== 'CLAIMED') {
      return '当前状态暂不可用';
    }

    if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) {
      return '优惠券已过期';
    }

    if (couponBaseAmountCents < coupon.thresholdAmountCents) {
      return `还差 ${formatPriceCents(coupon.thresholdAmountCents - couponBaseAmountCents)} 可用`;
    }

    return '';
  }

  const usableCouponCount = accountCoupons.filter((coupon) => coupon.id && !getCouponUnavailableReason(coupon)).length;
  const lockedCouponCount = accountCoupons.filter((coupon) => coupon.status === 'LOCKED').length;
  const addonCouponOpportunity = useMemo(() => {
    const candidates = accountCoupons
      .filter((coupon) => {
        if (!coupon.id) return false;
        if (coupon.status && coupon.status !== 'CLAIMED') return false;
        if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) return false;
        if (coupon.thresholdAmountCents <= 0) return false;
        const gap = coupon.thresholdAmountCents - couponBaseAmountCents;
        if (gap <= 0) return false;
        return gap <= 3000 || gap <= Math.max(1, Math.floor(couponBaseAmountCents * 0.5));
      })
      .map((coupon) => ({
        coupon,
        gapAmountCents: coupon.thresholdAmountCents - couponBaseAmountCents
      }))
      .sort((a, b) => a.gapAmountCents - b.gapAmountCents || (b.coupon.discountAmountCents || 0) - (a.coupon.discountAmountCents || 0));

    return candidates[0] || null;
  }, [accountCoupons, couponBaseAmountCents]);

  function getRecommendedCouponIds() {
    const usableCoupons = accountCoupons
      .filter((coupon) => coupon.id && !getCouponUnavailableReason(coupon))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    const stackableCoupons = usableCoupons.filter((coupon) => coupon.canStack !== false);
    if (stackableCoupons.length > 0) {
      return stackableCoupons.map((coupon) => coupon.id!).filter(Boolean);
    }

    return usableCoupons[0]?.id ? [usableCoupons[0].id] : [];
  }

  function handleToggleCoupon(coupon: CustomerCoupon) {
    const couponId = coupon.id;
    if (!couponId || getCouponUnavailableReason(coupon)) return;

    setCouponApplyMode('USER_COUPON');
    setCouponCode('');
    setCouponCodeFeedback('');
    setCouponCodeFeedbackType('idle');
    setSelectedUserCouponIds((current) => {
      if (current.includes(couponId)) {
        return current.filter((id) => id !== couponId);
      }

      if (coupon.canStack === false) {
        return [couponId];
      }

      const currentCoupons = accountCoupons.filter((item) => item.id && current.includes(item.id));
      const hasUnstackableCoupon = currentCoupons.some((item) => item.canStack === false);
      if (hasUnstackableCoupon) {
        return [couponId];
      }

      return [...current, couponId];
    });
  }

  function handleClearCouponSelection() {
    setCouponApplyMode('NONE');
    setSelectedUserCouponIds([]);
    setCouponCode('');
    setCouponCodeFeedback('');
    setCouponCodeFeedbackType('idle');
  }

  function handleUseRecommendedCoupons() {
    const recommendedCouponIds = getRecommendedCouponIds();
    setCouponCode('');
    setCouponCodeFeedback('');
    setCouponCodeFeedbackType('idle');
    setCouponApplyMode(recommendedCouponIds.length > 0 ? 'USER_COUPON' : 'NONE');
    setSelectedUserCouponIds(recommendedCouponIds);
  }

  function handleCouponCodeFocus() {
    setCouponApplyMode('CODE');
    setSelectedUserCouponIds([]);
    if (selectedUserCouponIds.length > 0) {
      setCouponCodeFeedback('已切换为兑换码模式，并自动取消已选优惠券。');
      setCouponCodeFeedbackType('success');
    }
  }

  async function handlePreviewQuote(options: { source?: 'coupon-code'; userCouponIds?: string[]; couponCode?: string } = {}): Promise<OrderQuotePreview | null> {
    setQuoteError('');

    if (checkoutItems.length === 0 || !storeId) {
      setQuoteError(stores.length === 0 ? '当前商品暂无可下单门店，请返回购物车或商品详情后重试。' : '请先确认商品和门店，再更新金额。');
      return null;
    }

    try {
      setPreviewLoading(true);
      const quoteUserCouponIds = options.userCouponIds ?? selectedUserCouponIds;
      const quoteCouponCode = options.couponCode ?? trimmedCouponCode;
      const payload = {
        storeId,
        fulfillmentType,
        items: checkoutItems.map((item) => ({ skuId: item.skuId, quantity: item.quantity })),
        ...(quoteUserCouponIds.length > 0 ? { userCouponIds: quoteUserCouponIds } : {}),
        ...(quoteUserCouponIds.length === 0 && quoteCouponCode ? { couponCode: quoteCouponCode } : {})
      };
      const nextPreview = getStoredCustomerAuthArtifact()
        ? await previewAuthenticatedOrderQuote(payload)
        : await previewOrderQuote(payload);
      const normalizedPreview = normalizeQuotePreview(nextPreview);

      if (!normalizedPreview) {
        throw new Error('金额更新失败，请重试。');
      }

      setQuotePreview(normalizedPreview);
      if (options.source === 'coupon-code') {
        const couponDiscount = normalizedPreview.couponDiscountAmountCents || 0;
        setCouponCodeFeedback(couponDiscount > 0
          ? `兑换码可用，已优惠 ${formatPriceCents(couponDiscount)}。`
          : '兑换码已校验，当前订单暂未产生优惠。');
        setCouponCodeFeedbackType('success');
      }
      return normalizedPreview;
    } catch (e) {
      setQuotePreview(null);
      const message = getCheckoutSubmitErrorMessage(e);
      setQuoteError(message);
      if (options.source === 'coupon-code') {
        setCouponCodeFeedback(message);
        setCouponCodeFeedbackType('error');
      }
      return null;
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleApplyCouponCode() {
    setCouponApplyMode('CODE');
    setSelectedUserCouponIds([]);

    if (!trimmedCouponCode) {
      setCouponCodeFeedback('请输入兑换码后再使用。');
      setCouponCodeFeedbackType('error');
      return;
    }

    await handlePreviewQuote({ source: 'coupon-code', userCouponIds: [], couponCode: trimmedCouponCode });
  }

  async function loadAddonRecommendations() {
    if (!addonCouponOpportunity) return;

    try {
      setAddonLoading(true);
      const products = await getProducts({ category: '今日推荐' });
      const existingSkuIds = new Set(checkoutItems.map((item) => item.skuId));
      const candidates: AddonRecommendation[] = [];

      for (const nextProduct of products as ProductSummary[]) {
        if (fulfillmentType === 'STORE_PICKUP' && nextProduct.supportsPickup === false) continue;
        if (fulfillmentType === 'SHIPPING' && nextProduct.supportsShipping === false) continue;

        for (const sku of nextProduct.skus) {
          const availableStock = getSkuAvailableStock(sku);
          if (existingSkuIds.has(sku.id) || availableStock <= 0) continue;

          if (storeId) {
            const skuStores = await getStores({ skuId: sku.id });
            if (!skuStores.some((store) => store.id === storeId)) {
              continue;
            }
          }

          candidates.push({
            productId: nextProduct.id,
            productName: nextProduct.name,
            sku,
            unitPriceCents: sku.memberPriceCents || sku.priceCents,
            availableStock,
            coverSrc: getProductArtwork(nextProduct.name).coverSrc
          });
        }
      }

      const gap = addonCouponOpportunity.gapAmountCents;
      candidates.sort((a, b) => {
        const aClose = a.unitPriceCents >= gap ? a.unitPriceCents - gap : gap - a.unitPriceCents + 10000;
        const bClose = b.unitPriceCents >= gap ? b.unitPriceCents - gap : gap - b.unitPriceCents + 10000;
        return aClose - bClose || a.unitPriceCents - b.unitPriceCents;
      });

      setAddonRecommendations(candidates.slice(0, 4));
    } catch (e) {
      Taro.showToast({
        title: getCheckoutSubmitErrorMessage(e),
        icon: 'none'
      });
    } finally {
      setAddonLoading(false);
    }
  }

  async function openAddonSheet() {
    if (!addonCouponOpportunity) return;
    setAddonSheetOpen(true);
    await loadAddonRecommendations();
  }

  function handleAddAddonItem(recommendation: AddonRecommendation) {
    const nextItem: CheckoutLine = {
      id: `addon-${recommendation.sku.id}`,
      productId: recommendation.productId,
      productName: recommendation.productName,
      skuId: recommendation.sku.id,
      skuName: recommendation.sku.name,
      quantity: 1,
      unitPriceCents: recommendation.unitPriceCents,
      lineAmountCents: recommendation.unitPriceCents
    };

    setAddonItems((current) => {
      const existing = current.find((item) => item.skuId === recommendation.sku.id);
      if (existing) {
        return current.map((item) => (
          item.skuId === recommendation.sku.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                lineAmountCents: item.unitPriceCents * (item.quantity + 1)
              }
            : item
        ));
      }

      return [...current, nextItem];
    });
    setAddonSheetOpen(false);
    setFeedback(addonCouponOpportunity
      ? `已加入凑单商品，再核对金额即可使用${addonCouponOpportunity.coupon.name}。`
      : '已加入凑单商品。');
    Taro.showToast({ title: '已加入凑单商品', icon: 'success' });
  }

  async function ensureNoPendingOrderBeforeSubmit(): Promise<boolean> {
    if (!shouldUseProtectedCheckoutOrderCreate() || !getStoredCustomerAuthArtifact()) {
      return true;
    }

    try {
      const orders = await getAuthenticatedOrders();
      const pendingOrders = orders.filter((item) => item.status === 'PENDING_PAYMENT');

      if (pendingOrders.length === 0) {
        return true;
      }

      const result = await Taro.showModal({
        title: '你已有待支付订单',
        content: '请先继续支付或取消旧订单，优惠券释放后再重新下单。',
        confirmText: '查看订单',
        cancelText: '留在本页'
      });

      if (result.confirm) {
        Taro.switchTab({ url: '/pages/orders/index' });
      }

      return false;
    } catch (e) {
      console.warn('待支付订单检查失败', e);
      return true;
    }
  }

  useEffect(() => {
    if (loading || submitting) return;
    if (!storeId || checkoutItems.length === 0) return;
    if (couponApplyMode === 'CODE' && trimmedCouponCode) return;

    const timer = setTimeout(() => {
      void handlePreviewQuote();
    }, 260);

    return () => {
      clearTimeout(timer);
    };
  }, [loading, submitting, storeId, fulfillmentType, selectedCouponIdsKey, trimmedCouponCode, checkoutItems, couponApplyMode]);

  async function handleSubmit() {
    setError('');
    setFeedback('');

    if (checkoutItems.length === 0 || !storeId) {
      setError('请先确认商品和门店。');
      return;
    }

    if (fulfillmentType === 'SHIPPING' && !hasCompleteShippingAddress) {
      setError(`请完整填写收货地址信息：${missingShippingFields.join('、')}。`);
      return;
    }

    const canContinueSubmit = await ensureNoPendingOrderBeforeSubmit();
    if (!canContinueSubmit) {
      return;
    }

    try {
      setSubmitting(true);
      setFeedback('正在提交订单，请稍候。');

      const payload: CreateOrderPayload = {
        storeId,
        fulfillmentType,
        items: checkoutItems.map((item) => ({ skuId: item.skuId, quantity: item.quantity }))
      };

      if (selectedUserCouponIds.length > 0) {
        payload.userCouponIds = selectedUserCouponIds;
      } else if (trimmedCouponCode) {
        payload.couponCode = trimmedCouponCode;
      }

      if (fulfillmentType === 'STORE_PICKUP') {
        payload.pickupDate = new Date().toISOString();
        payload.pickupTimeSlot = '10:00-12:00';
      } else {
        payload.shippingAddress = {
          receiverName: trimmedShippingAddress.receiverName,
          phone: trimmedShippingAddress.phone,
          province: trimmedShippingAddress.province,
          city: trimmedShippingAddress.city,
          district: trimmedShippingAddress.district,
          detail: trimmedShippingAddress.detail,
          postalCode: trimmedShippingAddress.postalCode || undefined
        };
      }

      const usesProtectedOrderCreate = shouldUseProtectedCheckoutOrderCreate();
      const storedAuthArtifact = getStoredCustomerAuthArtifact();

      if (usesProtectedOrderCreate && !storedAuthArtifact) {
        redirectToCustomerLogin(getCheckoutLoginRedirectTarget({
          productId,
          skuId,
          qty: String(qty),
          cartItemIds: cartItemIdsParam
        }));
        return;
      }

      const created = usesProtectedOrderCreate
        ? await createAuthenticatedOrder(payload)
        : await createOrder(payload);
      if (isCartCheckout && cartItemIds.length > 0) {
        try {
          await clearCartItems(cartItemIds);
        } catch (clearError) {
          console.warn('购物车已结算商品清理失败', clearError);
        }
      }
      setFeedback(`订单 ${created.orderNo} 已创建。`);
      Taro.showToast({
        title: '订单已创建',
        icon: 'success'
      });
      setTimeout(() => {
        Taro.switchTab({
          url: '/pages/orders/index'
        });
      }, 800);
    } catch (e) {
      setError(getCheckoutSubmitErrorMessage(e));
      setFeedback('');
    } finally {
      setSubmitting(false);
    }
  }

  if (!productId && !isCartCheckout) {
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
          <Text style={{ display: 'block', fontSize: '36rpx', fontWeight: '700', marginBottom: '12rpx' }}>下单</Text>
          <Text style={{ display: 'block', color: '#6b7280', marginBottom: '18rpx' }}>
            请先选择商品和规格，或从购物车进入确认订单。
          </Text>
          <Button className='ui-pressable ui-primary-button' hoverClass='ui-pressable-hover' type='primary' onClick={() => Taro.navigateBack()}>
            返回商品详情
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View className='page-fade-in' style={{ minHeight: '100vh', padding: '28rpx', paddingBottom: '160rpx', background: '#fff8ea' }}>
      <View className='brand-page-hero brand-checkout-hero' style={{ marginBottom: '24rpx' }}>
        <Image className='brand-page-hero-bg' src={homeHeroImage} mode='aspectFill' />
        <View className='brand-page-hero-shade' />
        <View className='brand-page-hero-copy'>
          <Text className='brand-page-hero-kicker'>绿膳荟干货海味店</Text>
          <Text className='brand-page-hero-title'>确认订单</Text>
          <Text className='brand-page-hero-subtitle'>核对商品、取货方式与服务门店。</Text>
        </View>
      </View>

      {error ? (
        <View
          style={{
            background: '#fdecec',
            borderRadius: '24rpx',
            padding: '24rpx',
            border: '2rpx solid #f6c7c7',
            marginBottom: '24rpx'
          }}
        >
          <Text style={{ display: 'block', fontSize: '28rpx', fontWeight: '600', marginBottom: '8rpx' }}>请完善下单信息</Text>
          <Text style={{ display: 'block', fontSize: '26rpx', color: '#9f2a1d' }}>{error}</Text>
        </View>
      ) : null}

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

      {loading ? (
        <View className='ui-skeleton-card'>
          <Text style={{ display: 'block', fontSize: '28rpx', fontWeight: '600', color: '#17231c', marginBottom: '20rpx' }}>
            正在加载下单信息…
          </Text>
          <View className='ui-skeleton-line' style={{ width: '68%', marginBottom: '16rpx' }} />
          <View className='ui-skeleton-block' style={{ height: '150rpx', marginBottom: '22rpx' }} />
          <View className='ui-skeleton-line' style={{ width: '92%', marginBottom: '16rpx' }} />
          <View className='ui-skeleton-pill' style={{ width: '240rpx' }} />
        </View>
      ) : checkoutItems.length === 0 ? (
        <View
          style={{
            background: '#ffffff',
            borderRadius: '24rpx',
            padding: '28rpx',
            textAlign: 'center'
          }}
        >
          <Text style={{ display: 'block', color: '#6b7280', marginBottom: '16rpx' }}>当前无法加载商品信息，请返回重试。</Text>
          <Button className='ui-pressable ui-primary-button' hoverClass='ui-pressable-hover' type='primary' onClick={() => Taro.navigateBack()}>
            返回商品详情
          </Button>
        </View>
      ) : (
        <View style={{ display: 'flex', flexDirection: 'column', gap: '24rpx' }}>
          <View
            style={{
              background: '#ffffff',
              borderRadius: '24rpx',
              padding: '28rpx',
              boxShadow: '0 10rpx 26rpx rgba(23, 35, 28, 0.06)',
              border: '2rpx solid #e8e0d3'
            }}
          >
            <Text style={{ display: 'block', fontSize: '32rpx', fontWeight: '800', marginBottom: '18rpx', color: '#17231c' }}>
              {isCartCheckout ? '购物车商品' : '商品信息'}
            </Text>
            <View style={{ display: 'flex', flexDirection: 'column', gap: '18rpx' }}>
              {checkoutItems.map((item) => (
                <View className='checkout-cart-line' key={item.id}>
                  <View
                    className='checkout-product-thumb'
                    style={{
                      width: '124rpx',
                      height: '124rpx',
                      borderRadius: '20rpx'
                    }}
                  >
                    <Image className='checkout-product-thumb-image' src={getProductArtwork(item.productName).coverSrc} mode='aspectFill' />
                    <View className='brand-art-thumb-badge'>
                      <Text>严选</Text>
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ display: 'block', fontSize: '32rpx', fontWeight: '700', color: '#17231c', marginBottom: '8rpx' }}>
                      {sanitizeProductDisplayName(item.productName)}
                    </Text>
                    <Text style={{ display: 'block', fontSize: '26rpx', color: '#6b7280', marginBottom: '12rpx' }}>
                      规格：{item.skuName} · 数量：{item.quantity}
                    </Text>
                    <View className='checkout-summary-row'>
                      <Text style={{ fontSize: '26rpx', fontWeight: '800', color: '#6b7280' }}>单价 {formatPriceCents(item.unitPriceCents)}</Text>
                      <Text className='checkout-summary-value'>小计 {formatPriceCents(item.lineAmountCents)}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            {!isCartCheckout ? (
              <View style={{ marginTop: '24rpx', paddingTop: '20rpx', borderTop: '2rpx solid #e8e0d3' }}>
                <Text style={{ display: 'block', fontSize: '26rpx', color: '#6b7280', marginBottom: '14rpx' }}>购买数量</Text>
                <View style={{ display: 'flex', alignItems: 'center', gap: '18rpx' }}>
                  <Button
                    className='ui-pressable'
                    hoverClass='ui-pressable-hover'
                    size='mini'
                    disabled={qty <= 1 || submitting}
                    onClick={() => setQty((current) => Math.max(1, current - 1))}
                  >
                  -
                  </Button>
                  <View
                    style={{
                      minWidth: '96rpx',
                      height: '62rpx',
                      borderRadius: '999rpx',
                      background: '#fffdfa',
                      border: '2rpx solid #e8e0d3',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Text style={{ fontSize: '30rpx', fontWeight: '800' }}>{qty}</Text>
                  </View>
                  <Button className='ui-pressable' hoverClass='ui-pressable-hover' size='mini' disabled={submitting} onClick={() => setQty((current) => current + 1)}>
                    +
                  </Button>
                </View>
              </View>
            ) : null}
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
            <Text style={{ display: 'block', fontSize: '30rpx', fontWeight: '800', marginBottom: '8rpx', color: '#17231c' }}>优惠券</Text>
            <Text style={{ display: 'block', fontSize: '24rpx', color: '#6b7280', marginBottom: '16rpx' }}>
              可选择不用券、单张券或可叠加优惠券，金额会自动更新。
            </Text>
            {accountCoupons.length > 0 ? (
              <View style={{ display: 'flex', flexDirection: 'column', gap: '14rpx' }}>
                <Text style={{ display: 'block', fontSize: '24rpx', color: usableCouponCount > 0 ? '#236b45' : '#9f2a1d', fontWeight: '700' }}>
                  账户内共有 {accountCoupons.length} 张优惠券，当前订单可用 {usableCouponCount} 张。
                </Text>
                {usableCouponCount === 0 ? (
                  <Text style={{ display: 'block', fontSize: '23rpx', color: '#6b7280' }}>
                    你有优惠券，但当前订单暂不满足使用条件，可查看下方原因。
                  </Text>
                ) : null}
                {lockedCouponCount > 0 ? (
                  <View
                    style={{
                      padding: '18rpx',
                      borderRadius: '18rpx',
                      background: '#fff4d8',
                      border: '2rpx solid #e8d4a8'
                    }}
                  >
                    <Text style={{ display: 'block', fontSize: '24rpx', color: '#6f4b16', fontWeight: '800', marginBottom: '8rpx' }}>
                      你的优惠券已用于待支付订单
                    </Text>
                    <Text style={{ display: 'block', fontSize: '23rpx', color: '#6b7280', marginBottom: '14rpx' }}>
                      去支付或取消订单后，已锁定优惠券会回到账户。
                    </Text>
                    <View style={{ display: 'flex', gap: '12rpx', flexWrap: 'wrap' }}>
                      <Button
                        className='ui-pressable ui-primary-button'
                        hoverClass='ui-pressable-hover'
                        size='mini'
                        type='primary'
                        onClick={() => {
                          Taro.switchTab({ url: '/pages/orders/index' });
                        }}
                      >
                        查看待支付订单
                      </Button>
                      <Button
                        className='ui-pressable'
                        hoverClass='ui-pressable-hover'
                        size='mini'
                        disabled={submitting}
                        onClick={refreshAccountCoupons}
                      >
                        刷新优惠券
                      </Button>
                    </View>
                  </View>
                ) : null}
                <View style={{ display: 'flex', gap: '12rpx', flexWrap: 'wrap' }}>
                  <Button
                    className='ui-pressable'
                    hoverClass='ui-pressable-hover'
                    size='mini'
                    disabled={submitting || usableCouponCount === 0}
                    onClick={handleUseRecommendedCoupons}
                  >
                    推荐最优组合
                  </Button>
                  <Button
                    className='ui-pressable'
                    hoverClass='ui-pressable-hover'
                    size='mini'
                    disabled={submitting || usableCouponCount === 0}
                    onClick={handleUseRecommendedCoupons}
                  >
                    全用
                  </Button>
                  <Button
                    className='ui-pressable'
                    hoverClass='ui-pressable-hover'
                    size='mini'
                    disabled={submitting}
                    onClick={handleClearCouponSelection}
                  >
                    不使用优惠券
                  </Button>
                </View>
                <View
                  className='ui-card-pressable'
                  hoverClass='ui-card-pressable-hover'
                  onClick={handleClearCouponSelection}
                  style={{
                    padding: '18rpx',
                    borderRadius: '18rpx',
                    background: selectedUserCouponIds.length === 0 ? '#eaf6ee' : '#fffdfa',
                    border: selectedUserCouponIds.length === 0 ? '2rpx solid #236b45' : '2rpx solid #e8e0d3'
                  }}
                >
                  <Text style={{ display: 'block', fontSize: '26rpx', color: '#17231c', fontWeight: '700' }}>本次暂不使用优惠券</Text>
                </View>
                {accountCoupons.map((coupon) => {
                  const unavailableReason = getCouponUnavailableReason(coupon);
                  const isSelected = Boolean(coupon.id && selectedUserCouponIds.includes(coupon.id));

                  return (
                    <View
                      key={coupon.id || coupon.templateId}
                      className='ui-card-pressable'
                      hoverClass='ui-card-pressable-hover'
                      onClick={() => {
                        handleToggleCoupon(coupon);
                      }}
                      style={{
                        padding: '18rpx',
                        borderRadius: '18rpx',
                        background: isSelected ? '#eaf6ee' : '#fffdfa',
                        border: isSelected ? '2rpx solid #236b45' : '2rpx solid #e8e0d3',
                        opacity: unavailableReason ? 0.58 : 1
                      }}
                    >
                      <View style={{ display: 'flex', justifyContent: 'space-between', gap: '16rpx', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ display: 'block', fontSize: '28rpx', color: '#17231c', fontWeight: '800', marginBottom: '6rpx' }}>
                            {coupon.name}
                          </Text>
                          <Text style={{ display: 'block', fontSize: '23rpx', color: unavailableReason ? '#9f2a1d' : '#6b7280' }}>
                            {unavailableReason || `${getCouponUseHint(coupon)} · ${coupon.canStack === false ? '不可叠加' : '可叠加'}`}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ display: 'block', fontSize: '30rpx', color: '#d94836', fontWeight: '900', textAlign: 'right' }}>
                            {getCouponDiscountText(coupon)}
                          </Text>
                          <Text style={{ display: 'block', fontSize: '22rpx', color: isSelected ? '#236b45' : '#6b7280', fontWeight: '700', textAlign: 'right' }}>
                            {unavailableReason ? '不可用' : isSelected ? '已选' : '选择'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View
                style={{
                  padding: '20rpx',
                  borderRadius: '18rpx',
                  background: '#fffdfa',
                  border: '2rpx solid #e8e0d3'
                }}
              >
                <Text style={{ display: 'block', fontSize: '26rpx', color: '#17231c', fontWeight: '700', marginBottom: '8rpx' }}>
                  当前账户暂无优惠券
                </Text>
                <Text style={{ display: 'block', fontSize: '24rpx', color: '#6b7280' }}>
                  {getStoredCustomerAuthArtifact() ? '当前暂无可用券，可到我的页面查看权益。' : '登录后自动领取新人优惠券。'}
                </Text>
              </View>
            )}

            <View style={{ marginTop: '22rpx', paddingTop: '20rpx', borderTop: '2rpx solid #e8e0d3' }}>
              <Text style={{ display: 'block', fontSize: '26rpx', fontWeight: '800', marginBottom: '8rpx', color: '#17231c' }}>有兑换码？</Text>
              <Text style={{ display: 'block', fontSize: '23rpx', color: '#6b7280', marginBottom: '14rpx' }}>
                兑换码与已领取优惠券不能同时使用，输入兑换码会自动取消已选优惠券。
              </Text>
              <View style={{ display: 'flex', gap: '12rpx', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Input
                    type='text'
                    placeholder='兑换码（选填）'
                    value={couponCode}
                    disabled={submitting}
                    onFocus={handleCouponCodeFocus}
                    onInput={(e) => {
                      setCouponApplyMode('CODE');
                      setCouponCode(e.detail.value);
                      setSelectedUserCouponIds([]);
                      setCouponCodeFeedback('');
                      setCouponCodeFeedbackType('idle');
                      if (error) setError('');
                    }}
                  />
                </View>
                <Button
                  className='ui-pressable'
                  hoverClass='ui-pressable-hover'
                  size='mini'
                  disabled={submitting || previewLoading}
                  loading={previewLoading && couponApplyMode === 'CODE'}
                  onClick={handleApplyCouponCode}
                >
                  {previewLoading && couponApplyMode === 'CODE' ? '校验中' : '使用兑换码'}
                </Button>
              </View>
              {couponCodeFeedback ? (
                <Text
                  style={{
                    display: 'block',
                    marginTop: '10rpx',
                    fontSize: '23rpx',
                    color: couponCodeFeedbackType === 'error' ? '#9f2a1d' : '#236b45',
                    fontWeight: '700'
                  }}
                >
                  {couponCodeFeedback}
                </Text>
              ) : null}
              {couponApplyMode === 'CODE' && trimmedCouponCode ? (
                <Button
                  className='ui-pressable'
                  hoverClass='ui-pressable-hover'
                  size='mini'
                  disabled={submitting}
                  style={{ marginTop: '12rpx' }}
                  onClick={handleClearCouponSelection}
                >
                  清空兑换码
                </Button>
              ) : null}
            </View>
          </View>

          {addonCouponOpportunity ? (
            <View
              style={{
                background: '#fff4d8',
                borderRadius: '24rpx',
                padding: '24rpx',
                border: '2rpx solid #e8d4a8',
                boxShadow: '0 8rpx 24rpx rgba(111, 75, 22, 0.06)'
              }}
            >
              <Text style={{ display: 'block', fontSize: '28rpx', color: '#6f4b16', fontWeight: '900', marginBottom: '8rpx' }}>
                再买 {formatPriceCents(addonCouponOpportunity.gapAmountCents)} 可用{addonCouponOpportunity.coupon.name}
              </Text>
              <Text style={{ display: 'block', fontSize: '24rpx', color: '#6b7280', marginBottom: '16rpx' }}>
                预计可减 {formatPriceCents(addonCouponOpportunity.coupon.discountAmountCents || 0)}，加入凑单商品后会自动重新计算金额。
              </Text>
              <Button className='ui-pressable ui-primary-button' hoverClass='ui-pressable-hover' size='mini' type='primary' onClick={openAddonSheet}>
                去凑单
              </Button>
            </View>
          ) : null}

          <View
            style={{
              background: '#ffffff',
              borderRadius: '24rpx',
              padding: '28rpx',
              boxShadow: '0 8rpx 24rpx rgba(23, 35, 28, 0.05)',
              border: '2rpx solid #e8e0d3'
            }}
          >
            <Text style={{ display: 'block', fontSize: '30rpx', fontWeight: '800', marginBottom: '8rpx', color: '#17231c' }}>金额明细</Text>
            <Text style={{ display: 'block', fontSize: '24rpx', color: '#6b7280', marginBottom: '18rpx' }}>
              可先更新优惠后的应付金额，提交订单时会再次确认价格。
            </Text>
            {quoteError ? (
              <Text style={{ display: 'block', fontSize: '24rpx', color: '#9f2a1d', marginBottom: '16rpx' }}>{quoteError}</Text>
            ) : !quotePreview ? (
              <View className='readable-info-list checkout-amount-list'>
                <View className='readable-info-row'>
                  <Text className='readable-info-label'>商品金额</Text>
                  <Text className='readable-info-value'>{formatPriceCents(totalAmountCents)}</Text>
                </View>
                <View className='readable-info-row'>
                  <Text className='readable-info-label'>会员优惠</Text>
                  <Text className='readable-info-value readable-info-muted'>更新后显示</Text>
                </View>
                <View className='readable-info-row'>
                  <Text className='readable-info-label'>优惠券优惠</Text>
                  <Text className='readable-info-value readable-info-muted'>{selectedCouponNames || trimmedCouponCode || '未选择优惠券'}</Text>
                </View>
              </View>
            ) : (
              <View className='readable-info-list checkout-amount-list'>
                <View className='readable-info-row'>
                  <Text className='readable-info-label'>商品金额</Text>
                  <Text className='readable-info-value'>{formatPriceCents(quotePreview.subtotalAmountCents)}</Text>
                </View>
                <View className='readable-info-row'>
                  <Text className='readable-info-label'>会员优惠</Text>
                  <Text className='readable-info-value readable-info-value-green'>-{formatPriceCents(quotePreview.memberDiscountAmountCents || 0)}</Text>
                </View>
                <View className='readable-info-row'>
                  <Text className='readable-info-label'>优惠券优惠</Text>
                  <Text className='readable-info-value readable-info-value-green'>-{formatPriceCents(quotePreview.couponDiscountAmountCents || 0)}</Text>
                </View>
                <View className='readable-info-row'>
                  <Text className='readable-info-label'>已用优惠</Text>
                  <Text className='readable-info-value readable-info-value-wrap'>
                    {quotePreview.couponApplications?.map((item) => item.couponNameSnapshot).join('、') ||
                      selectedCouponNames ||
                      quotePreview.appliedCouponCodes?.join('、') ||
                      quotePreview.appliedCouponCode?.trim() ||
                      '未使用优惠券'}
                  </Text>
                </View>
              </View>
            )}
            <View className='readable-info-row readable-total-row checkout-payable-row'>
              <Text className='readable-info-label readable-total-label'>应付金额</Text>
              <Text className='readable-info-value readable-total-amount'>{formatPriceCents(payableAmountCents)}</Text>
            </View>
            <Button
              className='ui-pressable'
              hoverClass='ui-pressable-hover'
              disabled={previewLoading || submitting}
              loading={previewLoading}
              onClick={handlePreviewQuote}
            >
              {previewLoading ? '更新中' : '更新金额'}
            </Button>
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
            <Text style={{ display: 'block', fontSize: '30rpx', fontWeight: '800', marginBottom: '8rpx', color: '#17231c' }}>取货方式</Text>
            <Text style={{ display: 'block', fontSize: '24rpx', color: '#6b7280', marginBottom: '18rpx' }}>
              可选择到店自提或邮寄发货，实际可选方式以商品配置为准。
            </Text>
            <View style={{ display: 'flex', gap: '16rpx' }}>
              <View
                className='ui-card-pressable'
                hoverClass='ui-card-pressable-hover'
                onClick={() => {
                  if (!supportsPickup || submitting) return;
                  setFulfillmentType('STORE_PICKUP');
                }}
                style={{
                  flex: 1,
                  padding: '22rpx',
                  borderRadius: '18rpx',
                  background: fulfillmentType === 'STORE_PICKUP' ? '#eaf6ee' : '#fffdfa',
                  border: fulfillmentType === 'STORE_PICKUP' ? '2rpx solid #236b45' : '2rpx solid #e8e0d3',
                  opacity: supportsPickup ? 1 : 0.45
                }}
              >
                <Text style={{ display: 'block', fontSize: '28rpx', fontWeight: '800', color: '#17231c' }}>到店自提</Text>
                <Text style={{ display: 'block', fontSize: '23rpx', color: '#6b7280', marginTop: '8rpx' }}>
                  到店核销提货码
                </Text>
              </View>
              <View
                className='ui-card-pressable'
                hoverClass='ui-card-pressable-hover'
                onClick={() => {
                  if (!supportsShipping || submitting) return;
                  setFulfillmentType('SHIPPING');
                }}
                style={{
                  flex: 1,
                  padding: '22rpx',
                  borderRadius: '18rpx',
                  background: fulfillmentType === 'SHIPPING' ? '#eaf6ee' : '#fffdfa',
                  border: fulfillmentType === 'SHIPPING' ? '2rpx solid #236b45' : '2rpx solid #e8e0d3',
                  opacity: supportsShipping ? 1 : 0.45
                }}
              >
                <Text style={{ display: 'block', fontSize: '28rpx', fontWeight: '800', color: '#17231c' }}>邮寄发货</Text>
                <Text style={{ display: 'block', fontSize: '23rpx', color: '#6b7280', marginTop: '8rpx' }}>
                  填写收货地址
                </Text>
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
            <View style={{ display: 'flex', alignItems: 'center', gap: '14rpx', marginBottom: '8rpx' }}>
              <Image className='brand-section-icon' src={serviceStoreImage} mode='aspectFill' />
              <Text style={{ display: 'block', fontSize: '30rpx', fontWeight: '800', color: '#17231c' }}>选择服务门店</Text>
            </View>
            <Text style={{ display: 'block', fontSize: '24rpx', color: '#6b7280', marginBottom: '18rpx' }}>
              请选择有库存的门店，用于自提或安排发货。
            </Text>
            {stores.length === 0 ? (
              <Text style={{ display: 'block', fontSize: '24rpx', color: '#6b7280' }}>
                当前规格暂无可服务的门店，请返回商品详情后重试。
              </Text>
            ) : (
              <View style={{ display: 'flex', flexDirection: 'column', gap: '16rpx' }}>
                {stores.map((store) => (
                  <View
                    key={store.id}
                    className='ui-card-pressable'
                    hoverClass='ui-card-pressable-hover'
                    onClick={() => {
                      if (!submitting) setStoreId(store.id);
                    }}
                    style={{
                      padding: '20rpx',
                      borderRadius: '18rpx',
                      background: store.id === storeId ? '#eaf6ee' : '#fffdfa',
                      border: store.id === storeId ? '2rpx solid #236b45' : '2rpx solid #e8e0d3'
                    }}
                  >
                    <View style={{ display: 'flex', justifyContent: 'space-between', gap: '12rpx' }}>
                      <Text style={{ display: 'block', fontSize: '28rpx', fontWeight: '700', marginBottom: '8rpx', flex: 1 }}>
                        {store.name}
                      </Text>
                      {store.id === storeId ? (
                        <Text style={{ fontSize: '22rpx', color: '#236b45', fontWeight: '700' }}>已选</Text>
                      ) : null}
                    </View>
                    <Text className='checkout-store-address'>{store.address}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {fulfillmentType === 'SHIPPING' ? (
            <View
              style={{
                background: '#ffffff',
                borderRadius: '24rpx',
                padding: '28rpx',
                boxShadow: '0 8rpx 24rpx rgba(23, 35, 28, 0.05)',
                border: '2rpx solid #e8e0d3'
              }}
            >
              <Text style={{ display: 'block', fontSize: '30rpx', fontWeight: '800', marginBottom: '8rpx', color: '#17231c' }}>收货地址</Text>
              <Text style={{ display: 'block', fontSize: '24rpx', color: '#6b7280', marginBottom: '18rpx' }}>
                请填写本次订单的收货信息。
              </Text>

              {addressBookLoading ? (
                <Text style={{ display: 'block', fontSize: '24rpx', color: '#6b7280', marginBottom: '16rpx' }}>正在读取默认地址，请稍候。</Text>
              ) : defaultAddress && !hasTouchedShippingAddress ? (
                <Text style={{ display: 'block', fontSize: '24rpx', color: '#236b45', marginBottom: '16rpx', fontWeight: '700' }}>
                  已自动带入默认地址，你也可以继续修改本次下单地址。
                </Text>
              ) : !defaultAddress ? (
                <Text style={{ display: 'block', fontSize: '24rpx', color: '#6b7280', marginBottom: '16rpx' }}>
                  当前没有默认地址，本次下单请手动填写收货地址。
                </Text>
              ) : null}

              <View style={{ display: 'flex', flexDirection: 'column', gap: '16rpx' }}>
                <Input
                  type='text'
                  placeholder='收货人'
                  value={shippingAddress.receiverName}
                  disabled={submitting}
                  onInput={(e) => {
                    setHasTouchedShippingAddress(true);
                    setShippingAddress((current) => ({ ...current, receiverName: e.detail.value }));
                  }}
                />
                <Input
                  type='text'
                  placeholder='联系电话'
                  value={shippingAddress.phone}
                  disabled={submitting}
                  onInput={(e) => {
                    setHasTouchedShippingAddress(true);
                    setShippingAddress((current) => ({ ...current, phone: e.detail.value }));
                  }}
                />
                <Input
                  type='text'
                  placeholder='省'
                  value={shippingAddress.province}
                  disabled={submitting}
                  onInput={(e) => {
                    setHasTouchedShippingAddress(true);
                    setShippingAddress((current) => ({ ...current, province: e.detail.value }));
                  }}
                />
                <Input
                  type='text'
                  placeholder='市'
                  value={shippingAddress.city}
                  disabled={submitting}
                  onInput={(e) => {
                    setHasTouchedShippingAddress(true);
                    setShippingAddress((current) => ({ ...current, city: e.detail.value }));
                  }}
                />
                <Input
                  type='text'
                  placeholder='区 / 区县'
                  value={shippingAddress.district}
                  disabled={submitting}
                  onInput={(e) => {
                    setHasTouchedShippingAddress(true);
                    setShippingAddress((current) => ({ ...current, district: e.detail.value }));
                  }}
                />
                <Input
                  type='text'
                  placeholder='详细地址'
                  value={shippingAddress.detail}
                  disabled={submitting}
                  onInput={(e) => {
                    setHasTouchedShippingAddress(true);
                    setShippingAddress((current) => ({ ...current, detail: e.detail.value }));
                  }}
                />
                <Input
                  type='text'
                  placeholder='邮政编码（选填）'
                  value={shippingAddress.postalCode}
                  disabled={submitting}
                  onInput={(e) => {
                    setHasTouchedShippingAddress(true);
                    setShippingAddress((current) => ({ ...current, postalCode: e.detail.value }));
                  }}
                />
              </View>

              <Text style={{ display: 'block', fontSize: '24rpx', color: '#6b7280', marginTop: '16rpx' }}>
                {hasCompleteShippingAddress
                  ? '地址信息已填写完整，提交订单时会保存为本次订单收货信息。'
                  : `当前还缺少：${missingShippingFields.join('、')}。`}
              </Text>
            </View>
          ) : null}

          <View
            style={{
              background: '#ffffff',
              borderRadius: '24rpx',
              padding: '28rpx',
              boxShadow: '0 8rpx 24rpx rgba(23, 35, 28, 0.05)',
              border: '2rpx solid #e8e0d3'
            }}
          >
            <Text style={{ display: 'block', fontSize: '30rpx', fontWeight: '800', marginBottom: '18rpx', color: '#17231c' }}>订单摘要</Text>
            <View className='readable-info-list'>
              <View className='readable-info-row'>
                <Text className='readable-info-label'>商品</Text>
                <Text className='readable-info-value readable-info-value-wrap'>
                  {isCartCheckout ? `共 ${checkoutItems.length} 款，${checkoutItems.reduce((sum, item) => sum + item.quantity, 0)} 件` : sanitizeProductDisplayName(firstCheckoutItem?.productName)}
                </Text>
              </View>
              <View className='readable-info-row'>
                <Text className='readable-info-label'>规格</Text>
                <Text className='readable-info-value readable-info-value-wrap'>
                  {isCartCheckout ? checkoutItems.map((item) => item.skuName).join('、') : firstCheckoutItem?.skuName}
                </Text>
              </View>
              <View className='readable-info-row'>
                <Text className='readable-info-label'>数量</Text>
                <Text className='readable-info-value'>{checkoutItems.reduce((sum, item) => sum + item.quantity, 0)}</Text>
              </View>
              <View className='readable-info-row'>
                <Text className='readable-info-label'>方式</Text>
                <Text className='readable-info-value'>{getFulfillmentLabel(fulfillmentType)}</Text>
              </View>
              <View className='readable-info-row'>
                <Text className='readable-info-label'>门店</Text>
                <Text className='readable-info-value readable-info-value-wrap'>
                  {selectedStore?.name || '请选择门店'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {addonSheetOpen ? (
        <RootPortal>
          <View className='sku-sheet-mask' catchMove onClick={() => setAddonSheetOpen(false)}>
            <View className='sku-sheet-panel' onClick={(event) => event.stopPropagation()} onTouchMove={(event) => event.stopPropagation()}>
              <View className='sku-sheet-handle' />
              <View className='sku-sheet-section' style={{ marginTop: 0 }}>
                <Text className='sku-sheet-section-title'>凑单推荐</Text>
                <Text style={{ display: 'block', fontSize: '24rpx', color: '#6b7280', marginBottom: '18rpx' }}>
                  {addonCouponOpportunity
                    ? `再买 ${formatPriceCents(addonCouponOpportunity.gapAmountCents)} 可用${addonCouponOpportunity.coupon.name}。`
                    : '为你推荐适合一起下单的商品。'}
                </Text>
                {addonLoading ? (
                  <View className='ui-skeleton-card'>
                    <View className='ui-skeleton-line' style={{ width: '70%', marginBottom: '18rpx' }} />
                    <View className='ui-skeleton-block' style={{ height: '150rpx' }} />
                  </View>
                ) : addonRecommendations.length === 0 ? (
                  <View style={{ padding: '24rpx', borderRadius: '20rpx', background: '#fffdfa', border: '2rpx solid #e8e0d3' }}>
                    <Text style={{ display: 'block', fontSize: '26rpx', color: '#17231c', fontWeight: '800', marginBottom: '8rpx' }}>暂无合适凑单商品</Text>
                    <Text style={{ display: 'block', fontSize: '24rpx', color: '#6b7280' }}>可以返回商品列表继续挑选。</Text>
                  </View>
                ) : (
                  <View style={{ display: 'flex', flexDirection: 'column', gap: '14rpx' }}>
                    {addonRecommendations.map((recommendation) => (
                      <View
                        key={recommendation.sku.id}
                        style={{
                          display: 'flex',
                          gap: '16rpx',
                          padding: '18rpx',
                          borderRadius: '20rpx',
                          background: '#fffdfa',
                          border: '2rpx solid #e8e0d3'
                        }}
                      >
                        <Image style={{ width: '112rpx', height: '112rpx', borderRadius: '18rpx' }} src={recommendation.coverSrc} mode='aspectFill' />
                        <View style={{ flex: 1 }}>
                          <Text style={{ display: 'block', fontSize: '28rpx', color: '#17231c', fontWeight: '800', marginBottom: '6rpx' }}>
                            {sanitizeProductDisplayName(recommendation.productName)}
                          </Text>
                          <Text style={{ display: 'block', fontSize: '23rpx', color: '#6b7280', marginBottom: '8rpx' }}>
                            {recommendation.sku.name} · 可售约 {recommendation.availableStock} 件
                          </Text>
                          <Text style={{ display: 'block', fontSize: '28rpx', color: '#d94836', fontWeight: '900' }}>
                            {formatPriceCents(recommendation.unitPriceCents)}
                          </Text>
                        </View>
                        <Button
                          className='ui-pressable ui-primary-button'
                          hoverClass='ui-pressable-hover'
                          size='mini'
                          type='primary'
                          style={{ alignSelf: 'center' }}
                          onClick={() => handleAddAddonItem(recommendation)}
                        >
                          加入
                        </Button>
                      </View>
                    ))}
                  </View>
                )}
              </View>
              <View className='sku-sheet-actions'>
                <Button className='ui-pressable' hoverClass='ui-pressable-hover' style={{ flex: 1 }} onClick={() => setAddonSheetOpen(false)}>
                  先不凑单
                </Button>
                <Button className='ui-pressable ui-primary-button' hoverClass='ui-pressable-hover' style={{ flex: 1 }} type='primary' onClick={() => Taro.switchTab({ url: '/pages/products/index' })}>
                  去商品列表
                </Button>
              </View>
            </View>
          </View>
        </RootPortal>
      ) : null}

      {checkoutItems.length > 0 ? (
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
              <Text style={{ display: 'block', fontSize: '22rpx', color: '#6b7280' }}>应付金额</Text>
              <Text style={{ display: 'block', fontSize: '36rpx', fontWeight: '800', color: '#d94836' }}>
                {formatPriceCents(payableAmountCents)}
              </Text>
            </View>
            <Text style={{ fontSize: '22rpx', color: '#6b7280' }}>{getFulfillmentLabel(fulfillmentType)}</Text>
          </View>
          <View style={{ display: 'flex', gap: '16rpx' }}>
            <Button className='ui-pressable' hoverClass='ui-pressable-hover' style={{ flex: 1 }} disabled={submitting} onClick={() => Taro.navigateBack()}>
              返回
            </Button>
            <Button
              className='ui-pressable ui-primary-button'
              hoverClass='ui-pressable-hover'
              style={{ flex: 2 }}
              type='primary'
              disabled={!canSubmit}
              loading={submitting}
              onClick={handleSubmit}
            >
              {submitting ? '提交中' : '提交订单'}
            </Button>
          </View>
        </View>
      ) : null}
    </View>
  );
}
