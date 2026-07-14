import type { ApiError } from '../../../../packages/shared-types/src/api-client-types';
import type { FulfillmentType, OrderStatus } from './orders';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3000';
const ADMIN_TOKEN_KEY = 'seafood_admin_auth_token';
const ADMIN_PROFILE_KEY = 'seafood_admin_profile';

export type AdminProfile = {
  adminId: string;
  username: string;
  displayName: string;
  role: 'ADMIN' | 'STORE_STAFF';
  storeId?: string | null;
};

export type AdminLoginResponse = {
  token: string;
  expiresAt: string;
  admin: AdminProfile;
};

export function getStoredAdminToken() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(ADMIN_TOKEN_KEY) || '';
}

export function getStoredAdminProfile(): AdminProfile | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(ADMIN_PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminProfile;
  } catch {
    return null;
  }
}

export function storeAdminSession(response: AdminLoginResponse) {
  window.localStorage.setItem(ADMIN_TOKEN_KEY, response.token);
  window.localStorage.setItem(ADMIN_PROFILE_KEY, JSON.stringify(response.admin));
}

export function clearAdminSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ADMIN_TOKEN_KEY);
  window.localStorage.removeItem(ADMIN_PROFILE_KEY);
}

async function loginRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(init?.headers || {})
      },
      cache: 'no-store'
    });
  } catch {
    throw new Error('后台服务连接失败，请确认 API 已启动。');
  }

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('账号或密码不正确。');
    }

    const err = (await res.json().catch(() => null)) as ApiError | null;
    throw new Error(err?.error?.message || '登录失败，请稍后重试。');
  }
  return res.json() as Promise<T>;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredAdminToken();
  if (!token) {
    throw new Error('请先登录后台');
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init?.headers || {})
      },
      cache: 'no-store'
    });
  } catch {
    throw new Error('后台服务连接失败，请确认 API 已启动。');
  }

  if (!res.ok) {
    if (res.status === 401) {
      clearAdminSession();
      throw new Error('登录状态已失效，请重新登录');
    }

    const err = (await res.json().catch(() => null)) as ApiError | null;
    throw new Error(err?.error?.message || '请求失败');
  }
  return res.json() as Promise<T>;
}

export const adminApi = {
  login: (payload: { username: string; password: string }) =>
    loginRequest<AdminLoginResponse>('/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  me: () => request<{ admin: AdminProfile }>('/admin/auth/me'),
  // Phase 2.41B：修改当前管理员自己的密码。不返回 token / passwordHash。
  changePassword: (payload: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
    request<{ ok: boolean }>('/admin/auth/change-password', { method: 'POST', body: JSON.stringify(payload) }),
  products: () => request<ProductRow[]>('/admin/products'),
  createProduct: (payload: CreateProductPayload) =>
    request<ProductRow>('/admin/products', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  // Phase 2.45B：价格未定草稿建档（不建 SKU/库存，后端强制 isPublished=false + internalTag=price_pending）。
  createDraftProduct: (payload: CreateDraftProductPayload) =>
    request<ProductRow>('/admin/products/draft', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateProduct: (id: string, payload: UpdateProductPayload) =>
    request<ProductRow>(`/admin/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  publishProduct: (id: string) => request<ProductRow>(`/admin/products/${id}/publish`, { method: 'POST' }),
  unpublishProduct: (id: string) => request<ProductRow>(`/admin/products/${id}/unpublish`, { method: 'POST' }),
  addSku: (productId: string, payload: CreateSkuPayload) =>
    request<ProductRow>(`/admin/products/${productId}/skus`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateSku: (skuId: string, payload: UpdateSkuPayload) =>
    request<ProductRow>(`/admin/skus/${skuId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  // Phase 2.42A：后台操作审计日志（仅 ADMIN）。
  auditLogs: (params: { limit?: number; entityType?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.entityType) qs.set('entityType', params.entityType);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<AdminAuditLogEntry[]>(`/admin/audit-logs${suffix}`);
  },
  stores: () => request<StoreRow[]>('/admin/stores'),
  inventory: () => request<InventoryRow[]>('/admin/inventory'),
  adjustInventory: (payload: AdjustInventoryPayload) =>
    request<InventoryRow>('/admin/inventory/adjust', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
};

// Phase 2.42A：后台操作审计日志条目。
export type AdminAuditLogEntry = {
  id: string;
  adminId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel?: string | null;
  summary?: string | null;
  metadataJson?: string | null;
  createdAt: string;
  admin?: { id: string; username: string; displayName: string } | null;
};

export type StoreRow = {
  id: string;
  code: string;
  name: string;
  address: string;
  contactName?: string | null;
  contactPhone?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProductSkuRow = {
  id: string;
  code: string;
  name: string;
  priceCents: number;
  isActive?: boolean;
  product?: {
    id: string;
    name: string;
  } | null;
};

export type ProductRow = {
  id: string;
  name: string;
  description?: string | null;
  coverImageUrl?: string | null;
  category?: string | null;
  sortOrder?: number | null;
  isRecommended?: boolean;
  isPublished: boolean;
  supportsPickup: boolean;
  supportsShipping: boolean;
  internalTag?: string | null;
  internalNote?: string | null;
  createdAt: string;
  updatedAt: string;
  skus: ProductSkuRow[];
};

export type CreateProductPayload = {
  name: string;
  description?: string;
  coverImageUrl?: string;
  supportsPickup: boolean;
  supportsShipping: boolean;
  defaultSkuName: string;
  defaultSkuCode?: string;
  defaultPriceCents: number;
  initialStoreId: string;
  initialStock: number;
};

// Phase 2.45B：价格未定草稿建档 payload。无价格/SKU/库存/门店字段；internalTag 由后端强制。
export type CreateDraftProductPayload = {
  name: string;
  description?: string;
  category?: string;
  coverImageUrl?: string;
  internalNote?: string;
};

export type UpdateProductPayload = {
  name: string;
  description?: string;
  coverImageUrl?: string;
  supportsPickup: boolean;
  supportsShipping: boolean;
  defaultSkuName?: string;
  defaultPriceCents?: number;
  internalTag?: string;
  internalNote?: string;
};

// Phase 2.38C：后台多 SKU 管理。priceCents 单位为分（前端元×100 后提交）。
export type CreateSkuPayload = {
  name: string;
  code?: string;
  priceCents: number;
};

export type UpdateSkuPayload = {
  name?: string;
  priceCents?: number;
  isActive?: boolean;
};

export type InventoryRow = {
  id: string;
  storeId: string;
  skuId: string;
  physicalStock: number;
  availableStock: number;
  reservedStock: number;
  damagedStock: number;
  safeStock: number;
  createdAt: string;
  updatedAt: string;
  store?: {
    id: string;
    name: string;
    address: string;
  };
  sku?: {
    id: string;
    code: string;
    name: string;
    priceCents: number;
    product?: {
      id: string;
      name: string;
    } | null;
  };
};

export type AdjustInventoryPayload = {
  storeId: string;
  skuId: string;
  deltaPhysical: number;
  deltaAvailable: number;
  reason: string;
  note?: string;
};

export type OrderItemSummary = {
  id: string;
  skuId: string;
  quantity: number;
  unitPriceCents: number;
  sku?: {
    id: string;
    code: string;
    name: string;
    priceCents: number;
    product?: {
      id: string;
      name: string;
      description?: string | null;
    } | null;
  } | null;
};

export type ShipmentSummary = {
  courierCompany: string;
  trackingNumber: string;
  shippedAt?: string | null;
  deliveredAt?: string | null;
};

export type ShipOrderPayload = {
  courierCompany: string;
  trackingNumber: string;
  shippingNote?: string;
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

export type OrderStatusLogEntry = {
  id: string;
  fromStatus?: OrderStatus | null;
  toStatus: OrderStatus;
  action?: string | null;
  reason?: string | null;
  operatorAdminId?: string | null;
  operatorAdmin?: { id: string; username: string; displayName: string } | null;
  createdAt: string;
};

// Phase 2.40B：订单内部备注（仅后台）。
export type OrderNoteEntry = {
  id: string;
  type: string;
  visibility: string;
  body: string;
  createdAt: string;
  authorAdminId?: string | null;
  author?: { id: string; username: string; displayName: string } | null;
};

export type CreateOrderNotePayload = {
  type?: string;
  body: string;
};

export type OrderSummary = {
  id: string;
  orderNo: string;
  storeId: string;
  store?: {
    id: string;
    code?: string | null;
    name: string;
    address?: string | null;
  } | null;
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
  // Phase 2.49D：鲜鱼预订单标记（后端 list 与 detail API 均派生返回）。true=鲜鱼预订，以门店称重确认为准、不在线支付。
  isFreshPreorder?: boolean;
  // Phase 2.49H：鲜鱼预订明细与派生文案。
  freshPreorderDetail?: FreshPreorderDetail | null;
  freshPreorderStageLabel?: string;
  freshPreorderActionHint?: string;
};

// Phase 2.49H：鲜鱼预订明细（仅鲜鱼预订单非空）。
export type FreshPreorderStage =
  | 'PENDING_STORE_CONFIRMATION'
  | 'CONFIRMED_WAITING_PICKUP'
  | 'COMPLETED_OFFLINE_SETTLED'
  | 'CANCELLED';

export type FreshPreorderDetail = {
  stage: FreshPreorderStage;
  estimatedTotalCents?: number | null;
  actualWeightJin?: string | number | null;
  actualUnitPriceCents?: number | null;
  finalTotalCents?: number | null;
  storeConfirmNote?: string | null;
  customerContactNote?: string | null;
  cancelReason?: string | null;
  confirmedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
};

export type FreshPreorderConfirmPayload = {
  actualWeightJin: number;
  actualUnitPriceCents?: number;
  finalTotalCents?: number;
  storeConfirmNote?: string;
  customerContactNote?: string;
  dryRun?: boolean;
};

export type OrderDetail = OrderSummary & {
  statusLogs: OrderStatusLogEntry[];
};

export const storeApi = {
  orders: () => request<OrderSummary[]>('/orders'),
  order: (id: string) => request<OrderDetail>(`/orders/${id}`),
  ready: (id: string) => request(`/orders/${id}/ready-for-pickup`, { method: 'POST' }),
  completePickup: (id: string, pickupCode: string) =>
    request(`/orders/${id}/complete-pickup`, { method: 'POST', body: JSON.stringify({ pickupCode }) }),
  ship: (id: string, payload: ShipOrderPayload) =>
    request(`/orders/${id}/ship`, { method: 'POST', body: JSON.stringify(payload) }),
  deliver: (id: string) => request(`/orders/${id}/deliver`, { method: 'POST' }),
  cancel: (id: string, reason?: string) =>
    request(`/orders/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  // Phase 2.40B：订单内部备注（仅后台）。
  orderNotes: (id: string) => request<OrderNoteEntry[]>(`/orders/${id}/notes`),
  addOrderNote: (id: string, payload: CreateOrderNotePayload) =>
    request<OrderNoteEntry>(`/orders/${id}/notes`, { method: 'POST', body: JSON.stringify(payload) }),
  // Phase 2.40C：软删除/撤回备注（不硬删）。
  softDeleteOrderNote: (orderId: string, noteId: string) =>
    request(`/orders/${orderId}/notes/${noteId}/delete`, { method: 'POST' }),
  // Phase 2.49H：鲜鱼预订正向处理动作（不在线支付）。
  freshPreorderConfirm: (id: string, payload: FreshPreorderConfirmPayload) =>
    request(`/orders/${id}/fresh-preorder/confirm`, { method: 'POST', body: JSON.stringify(payload) }),
  freshPreorderComplete: (id: string) =>
    request(`/orders/${id}/fresh-preorder/complete`, { method: 'POST', body: JSON.stringify({}) }),
  freshPreorderCancel: (id: string, cancelReason: string) =>
    request(`/orders/${id}/fresh-preorder/cancel`, { method: 'POST', body: JSON.stringify({ cancelReason }) })
};
