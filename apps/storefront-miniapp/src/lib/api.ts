import type { AuthSuccessResult } from '../../../../packages/shared-types/src';
import { getStoredCustomerAuthArtifact } from './identity-storage';
import { request } from './request';

export type FulfillmentType = 'STORE_PICKUP' | 'SHIPPING';

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID_PENDING_PREP'
  | 'READY_FOR_PICKUP'
  | 'COMPLETED'
  | 'PAID_PENDING_SHIPMENT'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'AFTER_SALES';

export type ProductSku = {
  id: string;
  code: string;
  name: string;
  priceCents: number;
  memberPriceCents?: number | null;
  availableStock?: number;
};

export type ProductSummary = {
  id: string;
  name: string;
  description?: string | null;
  coverImageUrl?: string | null;
  category?: string | null;
  // Phase 2.49L-a：商品分类标签，前台据此判定 fresh 并选用 fresh 占位图。
  internalTag?: string | null;
  sortOrder?: number;
  isRecommended?: boolean;
  supportsPickup?: boolean;
  supportsShipping?: boolean;
  skus: ProductSku[];
};

export type ProductDetail = ProductSummary;

export type StoreSummary = {
  id: string;
  name: string;
  address: string;
};

type GetStoresOptions = {
  skuId?: string;
};

export type GetProductsOptions = {
  category?: string;
  q?: string;
};

export type CartProductSummary = {
  id: string;
  name: string;
  description?: string | null;
  coverImageUrl?: string | null;
  category?: string | null;
  supportsPickup?: boolean;
  supportsShipping?: boolean;
  isFreshPreorder?: boolean;
};

export type CartItemSummary = {
  id: string;
  skuId: string;
  quantity: number;
  availableStock: number;
  unitPriceCents: number;
  lineAmountCents: number;
  sku: ProductSku;
  product: CartProductSummary;
};

export type CartSummary = {
  id: string;
  customerId: string;
  itemCount: number;
  subtotalAmountCents: number;
  items: CartItemSummary[];
  availableStores: StoreSummary[];
};

export type CustomerAddress = {
  id: string;
  customerId: string;
  receiverName: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  detail: string;
  postalCode?: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateCustomerAddressPayload = {
  receiverName: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  detail: string;
  postalCode?: string;
};

export type AuthExchangePlaceholderRequest = {
  provider: 'mock' | 'wechat';
  userId: string;
  displayName?: string;
  raw?: unknown;
};

export type AuthExchangePlaceholderResult = AuthSuccessResult & {
  provider: 'mock' | 'wechat';
  role?: 'CUSTOMER';
};

export type AuthExchangeRealRequest = {
  providerCredential?: string;
  providerCode?: string;
  providerState?: string;
  callbackPayload?: unknown;
  raw?: unknown;
};

export type AuthExchangeRealResult = AuthSuccessResult & {
  authArtifact: string;
};

export type VerifiedCustomerAuthIdentity = {
  provider: 'wechat';
  userId: string;
  role: 'CUSTOMER';
};

export type CreateOrderPayload = {
  storeId: string;
  fulfillmentType: FulfillmentType;
  items: Array<{
    skuId: string;
    quantity: number;
  }>;
  couponCode?: string;
  userCouponId?: string;
  userCouponIds?: string[];
  pickupDate?: string;
  pickupTimeSlot?: string;
  shippingAddress?: {
    receiverName: string;
    phone: string;
    province: string;
    city: string;
    district: string;
    detail: string;
    postalCode?: string;
  };
};

export type CreateOrderResponse = {
  id: string;
  orderNo: string;
  status: string;
  totalAmountCents: number;
  fulfillmentType: FulfillmentType;
  pickupCode?: string;
};

export type CancelOrderResponse = {
  result: 'CANCELLED' | 'ALREADY_CANCELLED';
};

export type OrderItemSummary = {
  id: string;
  skuId: string;
  quantity: number;
  unitPriceCents: number;
  lineAmountCents?: number;
  sku?: ProductSku & {
    product?: CartProductSummary;
  };
};

export type ShipmentSummary = {
  courierCompany: string;
  trackingNumber: string;
  shippedAt?: string | null;
  deliveredAt?: string | null;
};

export type PickupRecordSummary = {
  pickupCode: string;
  pickedUpAt?: string | null;
};

export type ShippingAddressSummary = {
  receiverName: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  detail: string;
  postalCode?: string | null;
};

export type OrderPriceAdjustment = {
  code: string;
  label?: string;
  amountCents: number;
};

export type OrderQuotePreviewRequest = {
  storeId: string;
  fulfillmentType: FulfillmentType;
  items: Array<{
    skuId: string;
    quantity: number;
  }>;
  couponCode?: string;
  userCouponId?: string;
  userCouponIds?: string[];
};

export type OrderQuotePreview = {
  subtotalAmountCents: number;
  baseAmountCents?: number;
  memberDiscountAmountCents?: number;
  couponDiscountAmountCents?: number;
  discountAmountCents: number;
  totalAmountCents: number;
  appliedCouponCode?: string | null;
  appliedUserCouponId?: string | null;
  appliedCouponCodes?: string[];
  appliedUserCouponIds?: string[];
  couponApplications?: OrderCouponApplicationSummary[];
  adjustments: OrderPriceAdjustment[];
};

export type CustomerCoupon = {
  id?: string;
  templateId: string;
  code: string;
  name: string;
  description?: string | null;
  discountType: 'AMOUNT_OFF' | 'PERCENT_OFF';
  thresholdAmountCents: number;
  discountAmountCents?: number | null;
  discountPercent?: number | null;
  maxDiscountAmountCents?: number | null;
  scene: string;
  stackGroup?: string | null;
  canStack?: boolean;
  priority?: number;
  autoGrantOnNewUser?: boolean;
  status?: string | null;
  lockedOrderId?: string | null;
  usedOrderId?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  expiresAt?: string | null;
  claimedAt?: string | null;
};

export type MemberProfileSummary = {
  customerId: string;
  inviteCode: string;
  isMember: boolean;
  memberLevel: string;
  benefits: string[];
};

export type ReferralInviteSummary = {
  inviteCode: string;
  shareTitle: string;
  sharePath: string;
};

export type ReferralSummary = ReferralInviteSummary & {
  invitedCount: number;
  rewardedCount: number;
  boundByInviteCode?: string | null;
  relationStatus?: string | null;
};

export type OrderSummary = {
  id: string;
  orderNo: string;
  storeId: string;
  fulfillmentType: FulfillmentType;
  status: OrderStatus;
  subtotalAmountCents?: number | null;
  discountAmountCents?: number | null;
  totalAmountCents: number;
  appliedCouponCode?: string | null;
  createdAt: string;
  items: OrderItemSummary[];
  memberDiscountAmountCents?: number | null;
  couponDiscountAmountCents?: number | null;
  couponApplications?: OrderCouponApplicationSummary[];
  isFreshPreorder?: boolean;
};

// Phase 2.48J：鲜鱼「提交预订」——写预订单，不触发支付。
export function createFreshPreorder(items: Array<{ skuId: string; quantity: number }>, storeId?: string) {
  return request<{ id: string; orderNo: string; status: string; totalAmountCents: number; isFreshPreorder: boolean; paymentRequired: boolean }>(
    '/orders/fresh-preorder/authenticated',
    {
      method: 'POST',
      data: { items, storeId },
      authArtifact: getStoredCustomerAuthArtifact() || undefined
    }
  );
}

export type OrderDetail = OrderSummary & {
  pickupDate?: string | null;
  pickupTimeSlot?: string | null;
  shipment?: ShipmentSummary | null;
  pickupRecord?: PickupRecordSummary | null;
  shippingAddress?: ShippingAddressSummary | null;
};

export type OrderCouponApplicationSummary = {
  id?: string;
  orderId?: string;
  userCouponId: string;
  couponTemplateId: string;
  couponCodeSnapshot: string;
  couponNameSnapshot: string;
  amountCents: number;
  createdAt?: string;
};

export type ReorderPreviewItem = {
  orderItemId: string;
  productId: string;
  productName: string;
  skuId: string;
  skuName: string;
  quantity: number;
  unitPriceCents: number;
  lineAmountCents: number;
  availableStock: number;
};

export type ReorderUnavailableItem = {
  orderItemId: string;
  productName: string;
  skuName: string;
  quantity: number;
  reason: string;
};

export type ReorderPreviewResponse = {
  orderId: string;
  orderNo: string;
  fulfillmentType: FulfillmentType;
  store: StoreSummary;
  purchasableItems: ReorderPreviewItem[];
  unavailableItems: ReorderUnavailableItem[];
  suggestedAction: 'ADD_TO_CART' | 'NONE';
  message: string;
};

export type PaymentTransitionResult = {
  result: string;
};

export type MiniappPaymentLaunchParams = {
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: 'RSA';
  paySign: string;
};

export type MiniappPaymentCreationResult = {
  provider: 'wechat';
  initiationType: 'MINIAPP';
  orderId: string;
  orderNo: string;
  totalAmountCents: number;
  launchParams: MiniappPaymentLaunchParams;
};

function buildPathWithQuery(path: string, query: Record<string, string | undefined>): string {
  const pairs = Object.entries(query).flatMap(([key, value]) => {
    const trimmedValue = value?.trim();
    return trimmedValue ? [`${encodeURIComponent(key)}=${encodeURIComponent(trimmedValue)}`] : [];
  });

  if (pairs.length === 0) {
    return path;
  }

  return `${path}?${pairs.join('&')}`;
}

export function getProducts(options: GetProductsOptions = {}) {
  return request<ProductSummary[]>(buildPathWithQuery('/products', {
    category: options.category,
    q: options.q
  }));
}

// Phase 2.48C：新鲜渔产目录（channel=fresh）。展示型，时价/联系确认，不进普通加购/支付。
export type FreshCatalogItem = {
  id: string;
  skuId?: string | null;
  name: string;
  description?: string | null;
  coverImageUrl?: string | null;
  category?: string | null;
  channel: string;
  businessLine?: string;
  priceMode?: string;
  displayPriceLabel: string;
  suggestedDisplayTag: string;
  unit?: string;
  referencePriceCents?: number | null;
  referencePriceLabel?: string | null;
  saleHint: string;
  orderMode?: string;
  canAddToCart: boolean;
  priceCents: number | null;
};

export function getFreshCatalog() {
  return request<FreshCatalogItem[]>(buildPathWithQuery('/products', { channel: 'fresh' }));
}

export function getProduct(id: string) {
  return request<ProductDetail>(`/products/${id}`);
}

export function getStores(options: GetStoresOptions = {}) {
  return request<StoreSummary[]>(buildPathWithQuery('/stores', { skuId: options.skuId }));
}

export function getCart() {
  return request<CartSummary>('/cart', {
    authArtifact: getStoredCustomerAuthArtifact() || undefined
  });
}

export function addCartItem(skuId: string, quantity: number) {
  return request<CartSummary>('/cart/items', {
    method: 'POST',
    data: { skuId, quantity },
    authArtifact: getStoredCustomerAuthArtifact() || undefined
  });
}

export function updateCartItemQuantity(itemId: string, quantity: number) {
  return request<CartSummary>(`/cart/items/${itemId}`, {
    method: 'PATCH',
    data: { quantity },
    authArtifact: getStoredCustomerAuthArtifact() || undefined
  });
}

export function removeCartItem(itemId: string) {
  return request<CartSummary>(`/cart/items/${itemId}`, {
    method: 'DELETE',
    authArtifact: getStoredCustomerAuthArtifact() || undefined
  });
}

export function clearCartItems(itemIds: string[]) {
  return request<CartSummary>('/cart/clear-items', {
    method: 'POST',
    data: { itemIds },
    authArtifact: getStoredCustomerAuthArtifact() || undefined
  });
}

export function getCustomerAddresses() {
  return request<CustomerAddress[]>('/customer/addresses');
}

export function getAuthenticatedCustomerAddresses() {
  return request<CustomerAddress[]>('/customer/addresses/authenticated', {
    authArtifact: getStoredCustomerAuthArtifact() || undefined
  });
}

export function createAuthenticatedCustomerAddress(payload: CreateCustomerAddressPayload) {
  return request<CustomerAddress>('/customer/addresses/authenticated', {
    method: 'POST',
    data: payload,
    authArtifact: getStoredCustomerAuthArtifact() || undefined
  });
}

export function setAuthenticatedCustomerAddressDefault(id: string) {
  return request<CustomerAddress>(`/customer/addresses/${id}/set-default/authenticated`, {
    method: 'POST',
    authArtifact: getStoredCustomerAuthArtifact() || undefined
  });
}

export function createOrder(payload: CreateOrderPayload) {
  return request<CreateOrderResponse>('/orders', {
    method: 'POST',
    data: payload
  });
}

export function createAuthenticatedOrder(payload: CreateOrderPayload) {
  return request<CreateOrderResponse>('/orders/authenticated', {
    method: 'POST',
    data: payload,
    authArtifact: getStoredCustomerAuthArtifact() || undefined
  });
}

export function previewOrderQuote(payload: OrderQuotePreviewRequest) {
  return request<OrderQuotePreview>('/orders/quote-preview', {
    method: 'POST',
    data: payload
  });
}

export function previewAuthenticatedOrderQuote(payload: OrderQuotePreviewRequest) {
  return request<OrderQuotePreview>('/orders/quote-preview/authenticated', {
    method: 'POST',
    data: payload,
    authArtifact: getStoredCustomerAuthArtifact() || undefined
  });
}

export function getAvailableCoupons() {
  return request<CustomerCoupon[]>('/coupons/available', {
    authArtifact: getStoredCustomerAuthArtifact() || undefined
  });
}

export function getMyCoupons() {
  return request<CustomerCoupon[]>('/coupons/my', {
    authArtifact: getStoredCustomerAuthArtifact() || undefined
  });
}

export function getClaimableCoupons() {
  return request<CustomerCoupon[]>('/coupons/claimable', {
    authArtifact: getStoredCustomerAuthArtifact() || undefined
  });
}

export function claimCoupon(payload: { templateCode?: string; templateId?: string }) {
  return request<CustomerCoupon>('/coupons/claim', {
    method: 'POST',
    data: payload,
    authArtifact: getStoredCustomerAuthArtifact() || undefined
  });
}

export function getMemberMe() {
  return request<MemberProfileSummary>('/members/me', {
    authArtifact: getStoredCustomerAuthArtifact() || undefined
  });
}

export function getMyInvite() {
  return request<ReferralInviteSummary>('/referrals/my-invite', {
    authArtifact: getStoredCustomerAuthArtifact() || undefined
  });
}

export function bindReferral(inviteCode: string) {
  return request<{ message: string }>('/referrals/bind', {
    method: 'POST',
    data: { inviteCode },
    authArtifact: getStoredCustomerAuthArtifact() || undefined
  });
}

export function getReferralSummary() {
  return request<ReferralSummary>('/referrals/summary', {
    authArtifact: getStoredCustomerAuthArtifact() || undefined
  });
}

export function getOrders() {
  return request<OrderSummary[]>('/orders');
}

export function getAuthenticatedOrders() {
  return request<OrderSummary[]>('/orders/authenticated', {
    authArtifact: getStoredCustomerAuthArtifact() || undefined
  });
}

export function getOrder(id: string) {
  return request<OrderDetail>(`/orders/${id}`);
}

export function getAuthenticatedOrder(id: string) {
  return request<OrderDetail>(`/orders/${id}/authenticated`, {
    authArtifact: getStoredCustomerAuthArtifact() || undefined
  });
}

export function cancelAuthenticatedOrder(id: string) {
  return request<CancelOrderResponse>(`/orders/${id}/cancel/authenticated`, {
    method: 'POST',
    authArtifact: getStoredCustomerAuthArtifact() || undefined
  });
}

export function previewAuthenticatedReorder(id: string) {
  return request<ReorderPreviewResponse>(`/orders/${id}/reorder-preview/authenticated`, {
    method: 'POST',
    authArtifact: getStoredCustomerAuthArtifact() || undefined
  });
}

export function markPaid(id: string, paymentRef: string, paidAmountCents: number) {
  return request<PaymentTransitionResult>(`/orders/${id}/mark-paid`, {
    method: 'POST',
    data: { paymentRef, paidAmountCents }
  });
}

export function createMiniappPayment(id: string) {
  return request<MiniappPaymentCreationResult>(`/orders/${id}/create-miniapp-payment`, {
    method: 'POST',
    authArtifact: getStoredCustomerAuthArtifact() || undefined
  });
}

export function exchangeAuthPlaceholder(payload: AuthExchangePlaceholderRequest) {
  return request<AuthExchangePlaceholderResult>('/auth/exchange-placeholder', {
    method: 'POST',
    data: payload
  });
}

export function exchangeAuthReal(payload: AuthExchangeRealRequest) {
  return request<AuthExchangeRealResult>('/auth/exchange-real', {
    method: 'POST',
    data: payload
  });
}

export function verifyCustomerAuthArtifact(authArtifact: string) {
  return request<VerifiedCustomerAuthIdentity>('/auth/verify-customer-artifact', {
    method: 'GET',
    authArtifact
  });
}
