export type RoleHeader = 'ADMIN' | 'STORE' | 'CUSTOMER';

export interface ApiError {
  success: false;
  error: {
    code: number;
    message: string;
    details?: unknown;
    path: string;
    timestamp: string;
  };
}

export interface CreateOrderRequest {
  storeId: string;
  fulfillmentType: 'STORE_PICKUP' | 'SHIPPING';
  items: Array<{ skuId: string; quantity: number }>;
  couponCode?: string;
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
}

export interface CreateOrderResponse {
  id: string;
  orderNo: string;
  status: string;
  totalAmountCents: number;
  fulfillmentType: 'STORE_PICKUP' | 'SHIPPING';
  pickupCode?: string;
}
