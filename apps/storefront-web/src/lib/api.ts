import type { AuthSuccessResult, ApiError, CreateOrderRequest, CreateOrderResponse } from '../../../../packages/shared-types/src';
import { CURRENT_STOREFRONT_PROFILE } from './config';

export type ProductSku = {
  id: string;
  name: string;
  priceCents: number;
};

export type ProductSummary = {
  id: string;
  name: string;
  description?: string;
  coverImageUrl?: string | null;
  skus: ProductSku[];
};

export type ProductDetail = ProductSummary;

export type StoreSummary = {
  id: string;
  name: string;
  address: string;
};

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

export type FulfillmentType = 'STORE_PICKUP' | 'SHIPPING';

export type OrderItemSummary = {
  id: string;
  skuId: string;
  quantity: number;
  unitPriceCents: number;
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
  providerCode: string;
};

export type AuthExchangeRealResult = AuthSuccessResult & {
  provider: 'wechat';
  role: 'CUSTOMER';
  authArtifact: string;
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

export type OrderStatusLogEntry = {
  id: string;
  fromStatus?: OrderStatus | null;
  toStatus: OrderStatus;
  reason?: string | null;
  createdAt: string;
};

export type OrderPriceAdjustment = {
  code: string;
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
};

export type OrderQuotePreview = {
  subtotalAmountCents: number;
  discountAmountCents: number;
  totalAmountCents: number;
  appliedCouponCode?: string | null;
  adjustments: OrderPriceAdjustment[];
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
  pickupDate?: string | null;
  pickupTimeSlot?: string | null;
  items: OrderItemSummary[];
  shipment?: ShipmentSummary | null;
  pickupRecord?: PickupRecordSummary | null;
  shippingAddress?: ShippingAddressSummary | null;
};

export type OrderDetail = OrderSummary & {
  statusLogs: OrderStatusLogEntry[];
};

export function mergeStorefrontRequestHeaders(headers?: HeadersInit): Headers {
  const mergedHeaders = new Headers(headers);

  if (!mergedHeaders.has('content-type')) {
    mergedHeaders.set('content-type', 'application/json');
  }

  return mergedHeaders;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CURRENT_STOREFRONT_PROFILE.apiBaseUrl}${path}`, {
    ...init,
    headers: mergeStorefrontRequestHeaders(init?.headers),
    cache: 'no-store'
  });

  if (!res.ok) {
    const err = (await res.json()) as ApiError;
    throw new Error(err.error?.message || 'Request failed');
  }
  return res.json() as Promise<T>;
}

export const STOREFRONT_CUSTOMER_TRANSACTION_HOLD_MESSAGE =
  '网页端暂不开放顾客交易，请使用微信小程序完成登录、下单和支付。';

function customerRequest<T>(
  _path: string,
  _init: RequestInit = {}
): Promise<T> {
  return Promise.reject<T>(
    new Error(STOREFRONT_CUSTOMER_TRANSACTION_HOLD_MESSAGE)
  );
}

export function getProducts() {
  return request<ProductSummary[]>('/products');
}

export function getProduct(id: string) {
  return request<ProductDetail>(`/products/${id}`);
}

export function getOrders() {
  return customerRequest<OrderSummary[]>('/orders/authenticated');
}

export function createOrder(payload: CreateOrderRequest) {
  return customerRequest<CreateOrderResponse>('/orders/authenticated', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function previewOrderQuote(payload: OrderQuotePreviewRequest) {
  return customerRequest<OrderQuotePreview>('/orders/quote-preview/authenticated', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getStores() {
  return request<StoreSummary[]>('/stores');
}

export function getOrder(id: string) {
  return customerRequest<OrderDetail>(`/orders/${id}/authenticated`);
}

export function cancelOrder(id: string) {
  return customerRequest<{ result: string }>(`/orders/${id}/cancel/authenticated`, {
    method: 'POST'
  });
}

export function getCustomerAddresses() {
  return customerRequest<CustomerAddress[]>('/customer/addresses/authenticated');
}

export function createCustomerAddress(payload: CreateCustomerAddressPayload) {
  return customerRequest<CustomerAddress>('/customer/addresses/authenticated', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function setDefaultCustomerAddress(id: string) {
  return customerRequest<CustomerAddress>(
    `/customer/addresses/${id}/set-default/authenticated`,
    {
      method: 'POST'
    }
  );
}

export function exchangeAuthPlaceholder(payload: AuthExchangePlaceholderRequest) {
  return request<AuthExchangePlaceholderResult>('/auth/exchange-placeholder', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function exchangeAuthReal(payload: AuthExchangeRealRequest) {
  return request<AuthExchangeRealResult>('/auth/exchange-real', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}
