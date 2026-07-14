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

export interface Inventory {
  id: string;
  storeId: string;
  skuId: string;
  physicalStock: number;
  availableStock: number;
  reservedStock: number;
}

export interface OrderItem {
  skuId: string;
  quantity: number;
}

export interface Order {
  id: string;
  storeId: string;
  fulfillmentType: FulfillmentType;
  status: OrderStatus;
  items: OrderItem[];
  pickupCode?: string;
}

export interface InventoryLog {
  orderId: string;
  inventoryId: string;
  action: string;
  deltaAvailable: number;
  deltaReserved: number;
  deltaPhysical: number;
}

export interface OrderStatusLog {
  orderId: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  reason?: string;
}
