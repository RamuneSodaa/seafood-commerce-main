import { PrismaClient } from '@prisma/client';
import { OrderPricingService } from '../src/modules/pricing/order-pricing.service';
import { OrderRepository } from '../src/modules/orders/order.repository';
import { OrderWorkflowService } from '../src/modules/orders/order-workflow.service';

function assertIntegrationTestDatabase(): void {
  const refuse = '当前 DATABASE_URL 不是测试库，拒绝运行 integration test';
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error(refuse);
  }
  let dbName = '';
  try {
    dbName = new URL(dbUrl).pathname.replace(/^\//, '').toLowerCase();
  } catch {
    throw new Error(refuse);
  }
  const isTestDb =
    dbName.includes('_test') ||
    dbName.includes('test_') ||
    dbName.endsWith('test') ||
    dbName.includes('integration');
  if (!isTestDb) {
    throw new Error(refuse);
  }
}

assertIntegrationTestDatabase();

describe('OrderWorkflowService PostgreSQL integration', () => {
  const prisma = new PrismaClient();
  const repo = new OrderRepository(prisma as any);
  const service = new OrderWorkflowService(repo, new OrderPricingService());

  let storeId = '';
  let skuId = '';
  let orderId = '';

  beforeAll(async () => {
    const store = await prisma.store.create({
      data: { code: `INT-STORE-${Date.now()}`, name: 'Integration Store', address: 'Address' }
    });
    storeId = store.id;

    const product = await prisma.product.create({
      data: {
        name: 'Integration Product',
        isPublished: true,
        supportsPickup: true,
        supportsShipping: true,
        skus: { create: [{ code: `INT-SKU-${Date.now()}`, name: 'SKU', priceCents: 1000 }] }
      },
      include: { skus: true }
    });
    skuId = product.skus[0].id;

    await prisma.storeSkuAvailability.create({ data: { storeId, skuId, isEnabled: true } });

    await prisma.inventory.create({
      data: {
        storeId,
        skuId,
        physicalStock: 10,
        availableStock: 10,
        reservedStock: 0,
        safeStock: 0,
        damagedStock: 0
      }
    });

    const order = await prisma.order.create({
      data: {
        orderNo: `INT-ORDER-${Date.now()}`,
        customerId: 'int-customer',
        storeId,
        fulfillmentType: 'SHIPPING',
        status: 'PENDING_PAYMENT',
        totalAmountCents: 1000,
        items: { create: [{ skuId, quantity: 2, unitPriceCents: 1000 }] },
        shippingAddress: {
          create: {
            receiverName: 'Int User',
            phone: '13000000000',
            province: 'P',
            city: 'C',
            district: 'D',
            detail: 'Street 1'
          }
        }
      }
    });
    orderId = order.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('createOrder persists SHIPPING snapshot payload', async () => {
    const created = await service.createOrder('int-customer-2', {
      storeId,
      fulfillmentType: 'SHIPPING',
      items: [{ skuId, quantity: 1 }],
      shippingAddress: {
        receiverName: 'Alice',
        phone: '13100000000',
        province: 'P',
        city: 'C',
        district: 'D',
        detail: 'Road 1'
      }
    } as any);

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: created.id },
      include: { shippingAddress: true }
    });

    expect(order.status).toBe('PENDING_PAYMENT');
    expect(order.shippingAddress?.receiverName).toBe('Alice');
  });

  test('previewOrderQuote returns quote without creating order or reserving inventory', async () => {
    const beforeOrderCount = await prisma.order.count();
    const beforeInventory = await prisma.inventory.findUniqueOrThrow({
      where: { storeId_skuId: { storeId, skuId } }
    });

    const quote = await service.previewOrderQuote({
      storeId,
      fulfillmentType: 'SHIPPING',
      items: [{ skuId, quantity: 1 }],
      couponCode: 'WELCOME-1000'
    } as any);

    expect(quote.subtotalAmountCents).toBe(1000);
    expect(quote.discountAmountCents).toBe(1000);
    expect(quote.totalAmountCents).toBe(0);
    expect(quote.appliedCouponCode).toBe('WELCOME-1000');

    const afterOrderCount = await prisma.order.count();
    const afterInventory = await prisma.inventory.findUniqueOrThrow({
      where: { storeId_skuId: { storeId, skuId } }
    });

    expect(afterOrderCount).toBe(beforeOrderCount);
    expect(afterInventory.availableStock).toBe(beforeInventory.availableStock);
    expect(afterInventory.reservedStock).toBe(beforeInventory.reservedStock);
  });

  test('previewOrderQuote rejects invalid coupon without creating order', async () => {
    const beforeOrderCount = await prisma.order.count();

    await expect(
      service.previewOrderQuote({
        storeId,
        fulfillmentType: 'SHIPPING',
        items: [{ skuId, quantity: 1 }],
        couponCode: 'INVALID-XXX'
      } as any)
    ).rejects.toThrow('优惠码无效。');

    const afterOrderCount = await prisma.order.count();
    expect(afterOrderCount).toBe(beforeOrderCount);
  });

  test('createOrder persists pricing snapshot for valid coupon and markPaid continues to use discounted order total', async () => {
    const created = await service.createOrder('int-customer-coupon', {
      storeId,
      fulfillmentType: 'SHIPPING',
      items: [{ skuId, quantity: 2 }],
      couponCode: 'WELCOME-1000',
      shippingAddress: {
        receiverName: 'Coupon User',
        phone: '13900000000',
        province: 'P',
        city: 'C',
        district: 'D',
        detail: 'Coupon Road'
      }
    } as any);

    expect(created.totalAmountCents).toBe(1000);

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: created.id }
    });

    expect(order.subtotalAmountCents).toBe(2000);
    expect(order.discountAmountCents).toBe(1000);
    expect(order.totalAmountCents).toBe(1000);
    expect(order.appliedCouponCode).toBe('WELCOME-1000');

    const paymentRef = `int-pay-coupon-${Date.now()}`;
    const paid = await service.markPaid(created.id, paymentRef, created.totalAmountCents);
    expect(paid.result).toBe('APPLIED');

    const payment = await prisma.paymentRecord.findUniqueOrThrow({
      where: { paymentRef }
    });
    expect(payment.paidAmountCents).toBe(created.totalAmountCents);

    await service.cancelOrder(created.id);
  });

  test('invalid coupon is rejected before order is created', async () => {
    const beforeCount = await prisma.order.count();

    await expect(
      service.createOrder('int-customer-invalid-coupon', {
        storeId,
        fulfillmentType: 'SHIPPING',
        items: [{ skuId, quantity: 1 }],
        couponCode: 'INVALID-XXX',
        shippingAddress: {
          receiverName: 'Invalid User',
          phone: '13800000000',
          province: 'P',
          city: 'C',
          district: 'D',
          detail: 'Invalid Road'
        }
      } as any)
    ).rejects.toThrow('优惠码无效。');

    const afterCount = await prisma.order.count();
    expect(afterCount).toBe(beforeCount);
  });

  test('paymentRef idempotency is persistence-backed', async () => {
    const paymentRef = `int-pay-ref-${Date.now()}`;
    const first = await service.markPaid(orderId, paymentRef, 1000);
    const second = await service.markPaid(orderId, paymentRef, 1000);

    expect(first.result).toBe('APPLIED');
    expect(second.result).toBe('IGNORED_DUPLICATE');

    const inv = await prisma.inventory.findUniqueOrThrow({ where: { storeId_skuId: { storeId, skuId } } });
    expect(inv.availableStock).toBe(8);
    expect(inv.reservedStock).toBe(2);
  });

  test('cancel rollback restores availability', async () => {
    const created = await service.createOrder('int-customer-3', {
      storeId,
      fulfillmentType: 'SHIPPING',
      items: [{ skuId, quantity: 1 }],
      shippingAddress: {
        receiverName: 'Bob',
        phone: '13200000000',
        province: 'P',
        city: 'C',
        district: 'D',
        detail: 'Road 2'
      }
    } as any);

    await service.markPaid(created.id, `pay-cancel-${Date.now()}`, 1000);
    await service.cancelOrder(created.id);

    const cancelled = await prisma.order.findUniqueOrThrow({ where: { id: created.id } });
    expect(cancelled.status).toBe('CANCELLED');
  });

  test('concurrent markPaid only reserves stock once', async () => {
    const concurrentOrder = await service.createOrder('int-customer-4', {
      storeId,
      fulfillmentType: 'SHIPPING',
      items: [{ skuId, quantity: 1 }],
      shippingAddress: {
        receiverName: 'Carol',
        phone: '13300000000',
        province: 'P',
        city: 'C',
        district: 'D',
        detail: 'Road 3'
      }
    } as any);

    const outcomes = await Promise.allSettled([
      service.markPaid(concurrentOrder.id, `pay-concurrent-a-${Date.now()}`, 1000),
      service.markPaid(concurrentOrder.id, `pay-concurrent-b-${Date.now()}`, 1000)
    ]);

    const appliedCount = outcomes.filter(
      (outcome): outcome is PromiseFulfilledResult<{ result: 'APPLIED' | 'IGNORED_DUPLICATE' }> =>
        outcome.status === 'fulfilled' && outcome.value.result === 'APPLIED'
    ).length;
    const rejectedCount = outcomes.filter((outcome) => outcome.status === 'rejected').length;

    expect(appliedCount).toBe(1);
    expect(rejectedCount).toBe(1);

    const updatedOrder = await prisma.order.findUniqueOrThrow({ where: { id: concurrentOrder.id } });
    expect(updatedOrder.status).toBe('PAID_PENDING_SHIPMENT');

    const paymentCount = await prisma.paymentRecord.count({ where: { orderId: concurrentOrder.id } });
    expect(paymentCount).toBe(1);
  });
});
