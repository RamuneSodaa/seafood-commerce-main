import type { AuthSuccessResult, ApiError, CreateOrderRequest, CreateOrderResponse } from '../../../../packages/shared-types/src';
import { CURRENT_STOREFRONT_PROFILE } from './config';
import { getStorefrontIdentity } from './identity';

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const identity = getStorefrontIdentity();

  const res = await fetch(`${CURRENT_STOREFRONT_PROFILE.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-role': identity.role,
      'x-user-id': identity.userId,
      ...(init?.headers || {})
    },
    cache: 'no-store'
  });

  if (!res.ok) {
    const err = (await res.json()) as ApiError;
    throw new Error(err.error?.message || 'Request failed');
  }
  return res.json() as Promise<T>;
}

export function getProducts() {
  return request<ProductSummary[]>('/products');
}

export function getProduct(id: string) {
  return request<ProductDetail>(`/products/${id}`);
}

export function getOrders() {
  return request<OrderSummary[]>('/orders');
}

export function createOrder(payload: CreateOrderRequest) {
  return request<CreateOrderResponse>('/orders', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function previewOrderQuote(payload: OrderQuotePreviewRequest) {
  return request<OrderQuotePreview>('/orders/quote-preview', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getStores() {
  return request<StoreSummary[]>('/stores');
}

export function getOrder(id: string) {
  return request<OrderDetail>(`/orders/${id}`);
}

export function markPaid(id: string, paymentRef: string, paidAmountCents: number) {
  return request<{ result: string }>(`/orders/${id}/mark-paid`, {
    method: 'POST',
    body: JSON.stringify({ paymentRef, paidAmountCents })
  });
}

export function cancelOrder(id: string) {
  return request<{ result: string }>(`/orders/${id}/cancel`, {
    method: 'POST'
  });
}

export function getCustomerAddresses() {
  return request<CustomerAddress[]>('/customer/addresses');
}

export function createCustomerAddress(payload: CreateCustomerAddressPayload) {
  return request<CustomerAddress>('/customer/addresses', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function setDefaultCustomerAddress(id: string) {
  return request<CustomerAddress>(`/customer/addresses/${id}/set-default`, {
    method: 'POST'
  });
}

export function exchangeAuthPlaceholder(payload: AuthExchangePlaceholderRequest) {
  return request<AuthExchangePlaceholderResult>('/auth/exchange-placeholder', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}
