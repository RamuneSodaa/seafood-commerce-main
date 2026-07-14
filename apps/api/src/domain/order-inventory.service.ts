import { Inventory, InventoryLog, Order, OrderStatus, OrderStatusLog } from './types';

export class OrderInventoryService {
  constructor(
    private readonly orders: Map<string, Order>,
    private readonly inventories: Map<string, Inventory>,
    private readonly inventoryLogs: InventoryLog[],
    private readonly orderStatusLogs: OrderStatusLog[],
    private readonly processedPaymentRefs: Set<string> = new Set(),
    private readonly orderPaymentRef: Map<string, string> = new Map()
  ) {}

  reserveAfterPayment(orderId: string, paymentRef: string): 'APPLIED' | 'IGNORED_DUPLICATE' {
    const order = this.mustOrder(orderId);

    if (this.processedPaymentRefs.has(paymentRef)) {
      const firstOrder = this.orderPaymentRef.get(paymentRef);
      if (firstOrder !== orderId) {
        throw new Error('Duplicate paymentRef used for a different order');
      }
      return 'IGNORED_DUPLICATE';
    }

    if (order.status !== 'PENDING_PAYMENT') {
      throw new Error('Invalid transition: payment only allowed from PENDING_PAYMENT');
    }

    const inventoryRows = this.precheckAvailableStock(order);

    for (const row of inventoryRows) {
      row.inventory.availableStock -= row.quantity;
      row.inventory.reservedStock += row.quantity;

      this.inventoryLogs.push({
        orderId,
        inventoryId: row.inventory.id,
        action: 'RESERVE_AFTER_PAYMENT',
        deltaAvailable: -row.quantity,
        deltaReserved: row.quantity,
        deltaPhysical: 0
      });
    }

    const toStatus: OrderStatus =
      order.fulfillmentType === 'STORE_PICKUP' ? 'PAID_PENDING_PREP' : 'PAID_PENDING_SHIPMENT';
    this.changeStatus(order, toStatus, `payment marked: ${paymentRef}`);

    this.processedPaymentRefs.add(paymentRef);
    this.orderPaymentRef.set(paymentRef, orderId);
    return 'APPLIED';
  }

  cancelOrder(orderId: string): void {
    const order = this.mustOrder(orderId);
    const cancellable = ['PENDING_PAYMENT', 'PAID_PENDING_PREP', 'PAID_PENDING_SHIPMENT', 'READY_FOR_PICKUP'];
    if (!cancellable.includes(order.status)) {
      throw new Error('Invalid transition: order cannot be cancelled');
    }

    if (order.status !== 'PENDING_PAYMENT') {
      const inventoryRows = this.precheckReservedStock(order, 'Reserved stock underflow');

      for (const row of inventoryRows) {
        row.inventory.reservedStock -= row.quantity;
        row.inventory.availableStock += row.quantity;

        this.inventoryLogs.push({
          orderId,
          inventoryId: row.inventory.id,
          action: 'ROLLBACK_ON_CANCEL',
          deltaAvailable: row.quantity,
          deltaReserved: -row.quantity,
          deltaPhysical: 0
        });
      }
    }

    this.changeStatus(order, 'CANCELLED', 'cancelled by user/admin');
  }

  markReadyForPickup(orderId: string): void {
    const order = this.mustOrder(orderId);
    if (order.fulfillmentType !== 'STORE_PICKUP' || order.status !== 'PAID_PENDING_PREP') {
      throw new Error('Invalid transition: ready for pickup');
    }
    this.changeStatus(order, 'READY_FOR_PICKUP', 'store prepared');
  }

  completePickup(orderId: string, pickupCode: string): void {
    const order = this.mustOrder(orderId);
    if (order.fulfillmentType !== 'STORE_PICKUP' || order.status !== 'READY_FOR_PICKUP') {
      throw new Error('Invalid transition: complete pickup');
    }
    if (!order.pickupCode || order.pickupCode !== pickupCode) {
      throw new Error('Invalid pickup code');
    }

    const inventoryRows = this.precheckReservedAndPhysical(order, 'Stock underflow on pickup');

    for (const row of inventoryRows) {
      row.inventory.reservedStock -= row.quantity;
      row.inventory.physicalStock -= row.quantity;

      this.inventoryLogs.push({
        orderId,
        inventoryId: row.inventory.id,
        action: 'DEDUCT_ON_PICKUP_COMPLETE',
        deltaAvailable: 0,
        deltaReserved: -row.quantity,
        deltaPhysical: -row.quantity
      });
    }

    this.changeStatus(order, 'COMPLETED', 'pickup completed');
  }

  shipOrder(orderId: string): void {
    const order = this.mustOrder(orderId);
    if (order.fulfillmentType !== 'SHIPPING' || order.status !== 'PAID_PENDING_SHIPMENT') {
      throw new Error('Invalid transition: ship order');
    }

    const inventoryRows = this.precheckReservedAndPhysical(order, 'Stock underflow on shipment');

    for (const row of inventoryRows) {
      row.inventory.reservedStock -= row.quantity;
      row.inventory.physicalStock -= row.quantity;

      this.inventoryLogs.push({
        orderId,
        inventoryId: row.inventory.id,
        action: 'DEDUCT_ON_SHIPPED',
        deltaAvailable: 0,
        deltaReserved: -row.quantity,
        deltaPhysical: -row.quantity
      });
    }

    this.changeStatus(order, 'SHIPPED', 'shipment created and shipped');
  }

  markDelivered(orderId: string): void {
    const order = this.mustOrder(orderId);
    if (order.fulfillmentType !== 'SHIPPING' || order.status !== 'SHIPPED') {
      throw new Error('Invalid transition: deliver order');
    }

    this.changeStatus(order, 'DELIVERED', 'shipping delivered');
  }

  private precheckAvailableStock(order: Order): Array<{ inventory: Inventory; quantity: number }> {
    const rows = order.items.map((item) => ({
      inventory: this.mustInventory(order.storeId, item.skuId),
      quantity: item.quantity
    }));

    for (const row of rows) {
      if (row.inventory.availableStock < row.quantity) {
        throw new Error('Insufficient available stock');
      }
    }
    return rows;
  }

  private precheckReservedStock(order: Order, errorMsg: string): Array<{ inventory: Inventory; quantity: number }> {
    const rows = order.items.map((item) => ({
      inventory: this.mustInventory(order.storeId, item.skuId),
      quantity: item.quantity
    }));

    for (const row of rows) {
      if (row.inventory.reservedStock < row.quantity) {
        throw new Error(errorMsg);
      }
    }
    return rows;
  }

  private precheckReservedAndPhysical(order: Order, errorMsg: string): Array<{ inventory: Inventory; quantity: number }> {
    const rows = order.items.map((item) => ({
      inventory: this.mustInventory(order.storeId, item.skuId),
      quantity: item.quantity
    }));

    for (const row of rows) {
      if (row.inventory.reservedStock < row.quantity || row.inventory.physicalStock < row.quantity) {
        throw new Error(errorMsg);
      }
    }
    return rows;
  }

  private changeStatus(order: Order, toStatus: OrderStatus, reason?: string): void {
    const fromStatus = order.status;
    order.status = toStatus;
    this.orderStatusLogs.push({
      orderId: order.id,
      fromStatus,
      toStatus,
      reason
    });
  }

  private mustOrder(orderId: string): Order {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }
    return order;
  }

  private mustInventory(storeId: string, skuId: string): Inventory {
    const key = `${storeId}:${skuId}`;
    const inventory = this.inventories.get(key);
    if (!inventory) {
      throw new Error(`Inventory not found: ${key}`);
    }
    return inventory;
  }
}
