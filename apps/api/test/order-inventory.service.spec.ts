import { OrderInventoryService } from '../src/domain/order-inventory.service';
import { Inventory, InventoryLog, Order, OrderStatusLog } from '../src/domain/types';

function setup() {
  const orders = new Map<string, Order>();
  const inventories = new Map<string, Inventory>();
  const inventoryLogs: InventoryLog[] = [];
  const orderStatusLogs: OrderStatusLog[] = [];

  inventories.set('store-1:sku-1', {
    id: 'inv-1',
    storeId: 'store-1',
    skuId: 'sku-1',
    physicalStock: 10,
    availableStock: 10,
    reservedStock: 0
  });

  inventories.set('store-1:sku-2', {
    id: 'inv-2',
    storeId: 'store-1',
    skuId: 'sku-2',
    physicalStock: 3,
    availableStock: 3,
    reservedStock: 0
  });

  const service = new OrderInventoryService(orders, inventories, inventoryLogs, orderStatusLogs);
  return { service, orders, inventories, inventoryLogs, orderStatusLogs };
}

describe('OrderInventoryService critical flows', () => {
  test('reserve after payment moves available -> reserved and writes logs', () => {
    const { service, orders, inventories, inventoryLogs, orderStatusLogs } = setup();
    orders.set('o1', {
      id: 'o1',
      storeId: 'store-1',
      fulfillmentType: 'STORE_PICKUP',
      status: 'PENDING_PAYMENT',
      pickupCode: '123456',
      items: [{ skuId: 'sku-1', quantity: 3 }]
    });

    expect(service.reserveAfterPayment('o1', 'pay-1')).toBe('APPLIED');

    const inv = inventories.get('store-1:sku-1')!;
    expect(inv.availableStock).toBe(7);
    expect(inv.reservedStock).toBe(3);
    expect(orders.get('o1')!.status).toBe('PAID_PENDING_PREP');

    expect(inventoryLogs).toHaveLength(1);
    expect(inventoryLogs[0].action).toBe('RESERVE_AFTER_PAYMENT');
    expect(orderStatusLogs).toHaveLength(1);
    expect(orderStatusLogs[0].toStatus).toBe('PAID_PENDING_PREP');
  });

  test('repeated payment event with same paymentRef is idempotent and does not double-reserve', () => {
    const { service, orders, inventories, inventoryLogs, orderStatusLogs } = setup();
    orders.set('o2', {
      id: 'o2',
      storeId: 'store-1',
      fulfillmentType: 'SHIPPING',
      status: 'PENDING_PAYMENT',
      items: [{ skuId: 'sku-1', quantity: 2 }]
    });

    expect(service.reserveAfterPayment('o2', 'pay-2')).toBe('APPLIED');
    expect(service.reserveAfterPayment('o2', 'pay-2')).toBe('IGNORED_DUPLICATE');

    const inv = inventories.get('store-1:sku-1')!;
    expect(inv.availableStock).toBe(8);
    expect(inv.reservedStock).toBe(2);
    expect(inventoryLogs).toHaveLength(1);
    expect(orderStatusLogs).toHaveLength(1);
  });

  test('duplicate paymentRef across different orders is rejected', () => {
    const { service, orders } = setup();
    orders.set('o3a', {
      id: 'o3a',
      storeId: 'store-1',
      fulfillmentType: 'SHIPPING',
      status: 'PENDING_PAYMENT',
      items: [{ skuId: 'sku-1', quantity: 1 }]
    });
    orders.set('o3b', {
      id: 'o3b',
      storeId: 'store-1',
      fulfillmentType: 'SHIPPING',
      status: 'PENDING_PAYMENT',
      items: [{ skuId: 'sku-1', quantity: 1 }]
    });

    service.reserveAfterPayment('o3a', 'pay-shared');
    expect(() => service.reserveAfterPayment('o3b', 'pay-shared')).toThrow('Duplicate paymentRef used for a different order');
  });

  test('multi-item cancel rollback is all-or-nothing (precheck)', () => {
    const { service, orders, inventories } = setup();
    orders.set('o4', {
      id: 'o4',
      storeId: 'store-1',
      fulfillmentType: 'SHIPPING',
      status: 'PENDING_PAYMENT',
      items: [
        { skuId: 'sku-1', quantity: 2 },
        { skuId: 'sku-2', quantity: 1 }
      ]
    });

    service.reserveAfterPayment('o4', 'pay-4');

    // Corrupt one reserved bucket to simulate inconsistent partial state before cancel.
    inventories.get('store-1:sku-2')!.reservedStock = 0;

    const before1 = { ...inventories.get('store-1:sku-1')! };
    const before2 = { ...inventories.get('store-1:sku-2')! };

    expect(() => service.cancelOrder('o4')).toThrow('Reserved stock underflow');

    expect(inventories.get('store-1:sku-1')).toEqual(before1);
    expect(inventories.get('store-1:sku-2')).toEqual(before2);
  });

  test('multi-item pickup is all-or-nothing (precheck)', () => {
    const { service, orders, inventories } = setup();
    orders.set('o5', {
      id: 'o5',
      storeId: 'store-1',
      fulfillmentType: 'STORE_PICKUP',
      status: 'PENDING_PAYMENT',
      pickupCode: '555555',
      items: [
        { skuId: 'sku-1', quantity: 2 },
        { skuId: 'sku-2', quantity: 1 }
      ]
    });

    service.reserveAfterPayment('o5', 'pay-5');
    service.markReadyForPickup('o5');

    // Force one item to fail underflow precheck.
    inventories.get('store-1:sku-2')!.physicalStock = 0;

    const before1 = { ...inventories.get('store-1:sku-1')! };
    const before2 = { ...inventories.get('store-1:sku-2')! };

    expect(() => service.completePickup('o5', '555555')).toThrow('Stock underflow on pickup');
    expect(inventories.get('store-1:sku-1')).toEqual(before1);
    expect(inventories.get('store-1:sku-2')).toEqual(before2);
  });

  test('multi-item shipment is all-or-nothing (precheck)', () => {
    const { service, orders, inventories } = setup();
    orders.set('o6', {
      id: 'o6',
      storeId: 'store-1',
      fulfillmentType: 'SHIPPING',
      status: 'PENDING_PAYMENT',
      items: [
        { skuId: 'sku-1', quantity: 2 },
        { skuId: 'sku-2', quantity: 1 }
      ]
    });

    service.reserveAfterPayment('o6', 'pay-6');
    inventories.get('store-1:sku-2')!.physicalStock = 0;

    const before1 = { ...inventories.get('store-1:sku-1')! };
    const before2 = { ...inventories.get('store-1:sku-2')! };

    expect(() => service.shipOrder('o6')).toThrow('Stock underflow on shipment');
    expect(inventories.get('store-1:sku-1')).toEqual(before1);
    expect(inventories.get('store-1:sku-2')).toEqual(before2);
  });

  test('invalid pickup code is rejected', () => {
    const { service, orders } = setup();
    orders.set('o7', {
      id: 'o7',
      storeId: 'store-1',
      fulfillmentType: 'STORE_PICKUP',
      status: 'PENDING_PAYMENT',
      pickupCode: '777777',
      items: [{ skuId: 'sku-1', quantity: 1 }]
    });

    service.reserveAfterPayment('o7', 'pay-7');
    service.markReadyForPickup('o7');
    expect(() => service.completePickup('o7', 'bad-code')).toThrow('Invalid pickup code');
  });

  test('shipment cannot be marked shipped twice', () => {
    const { service, orders } = setup();
    orders.set('o8', {
      id: 'o8',
      storeId: 'store-1',
      fulfillmentType: 'SHIPPING',
      status: 'PENDING_PAYMENT',
      items: [{ skuId: 'sku-1', quantity: 1 }]
    });

    service.reserveAfterPayment('o8', 'pay-8');
    service.shipOrder('o8');
    expect(() => service.shipOrder('o8')).toThrow('Invalid transition: ship order');
  });

  test('cancelled orders cannot be fulfilled', () => {
    const { service, orders } = setup();
    orders.set('o9', {
      id: 'o9',
      storeId: 'store-1',
      fulfillmentType: 'STORE_PICKUP',
      status: 'PENDING_PAYMENT',
      pickupCode: '999999',
      items: [{ skuId: 'sku-1', quantity: 1 }]
    });

    service.reserveAfterPayment('o9', 'pay-9');
    service.cancelOrder('o9');

    expect(() => service.markReadyForPickup('o9')).toThrow('Invalid transition: ready for pickup');
    expect(() => service.completePickup('o9', '999999')).toThrow('Invalid transition: complete pickup');
  });

  test('delivered is terminal and shipped cannot rollback through cancel', () => {
    const { service, orders } = setup();
    orders.set('o10', {
      id: 'o10',
      storeId: 'store-1',
      fulfillmentType: 'SHIPPING',
      status: 'PENDING_PAYMENT',
      items: [{ skuId: 'sku-1', quantity: 1 }]
    });

    service.reserveAfterPayment('o10', 'pay-10');
    service.shipOrder('o10');
    service.markDelivered('o10');

    expect(() => service.markDelivered('o10')).toThrow('Invalid transition: deliver order');
    expect(() => service.cancelOrder('o10')).toThrow('Invalid transition: order cannot be cancelled');
  });

  test('inventory and status logs are emitted for every successful transition/mutation in pickup path', () => {
    const { service, orders, inventoryLogs, orderStatusLogs } = setup();
    orders.set('o11', {
      id: 'o11',
      storeId: 'store-1',
      fulfillmentType: 'STORE_PICKUP',
      status: 'PENDING_PAYMENT',
      pickupCode: '111111',
      items: [{ skuId: 'sku-1', quantity: 1 }]
    });

    service.reserveAfterPayment('o11', 'pay-11');
    service.markReadyForPickup('o11');
    service.completePickup('o11', '111111');

    expect(inventoryLogs.map((x) => x.action)).toEqual(['RESERVE_AFTER_PAYMENT', 'DEDUCT_ON_PICKUP_COMPLETE']);
    expect(orderStatusLogs.map((x) => x.toStatus)).toEqual(['PAID_PENDING_PREP', 'READY_FOR_PICKUP', 'COMPLETED']);
  });

  test('prevent negative stock when reserving', () => {
    const { service, orders } = setup();
    orders.set('o12', {
      id: 'o12',
      storeId: 'store-1',
      fulfillmentType: 'STORE_PICKUP',
      status: 'PENDING_PAYMENT',
      pickupCode: '121212',
      items: [{ skuId: 'sku-1', quantity: 100 }]
    });

    expect(() => service.reserveAfterPayment('o12', 'pay-12')).toThrow('Insufficient available stock');
  });
});
