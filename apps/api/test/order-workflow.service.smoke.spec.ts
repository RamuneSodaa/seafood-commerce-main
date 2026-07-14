import { BadRequestException, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createCipheriv, createSign, generateKeyPairSync } from 'crypto';
import { UserRole } from '../src/common/roles/role.enum';
import { MiniappPaymentCallbackVerificationService } from '../src/modules/orders/miniapp-payment-callback-verification.service';
import { OrderPricingService } from '../src/modules/pricing/order-pricing.service';
import { OrderWorkflowService } from '../src/modules/orders/order-workflow.service';

function buildSignedWechatCallbackVerificationFixture(rawBody: string) {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const wechatpayTimestamp = '1712563200';
  const wechatpayNonce = 'wechatpay-nonce-1';
  const wechatpaySerial = 'wechatpay-platform-serial-1';
  const signer = createSign('RSA-SHA256');
  signer.update(`${wechatpayTimestamp}\n${wechatpayNonce}\n${rawBody}\n`);
  signer.end();

  return {
    env: {
      publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      serial: wechatpaySerial
    },
    input: {
      rawBody,
      wechatpayTimestamp,
      wechatpayNonce,
      wechatpaySerial,
      wechatpaySignature: signer.sign(privateKey, 'base64')
    }
  };
}

const TEST_WECHAT_PAY_API_V3_KEY = '12345678901234567890123456789012';

function buildNonLegacyPaymentTx() {
  return {
    freshPreorderDetail: { count: async () => 0 },
    orderNote: { count: async () => 0 }
  };
}

function buildEncryptedWechatResourceCallbackBody(payload: Record<string, unknown>, apiV3Key = TEST_WECHAT_PAY_API_V3_KEY) {
  const associatedData = 'transaction';
  const nonce = 'replay-nonce-1';
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(apiV3Key, 'utf8'), Buffer.from(nonce, 'utf8'));
  cipher.setAAD(Buffer.from(associatedData, 'utf8'));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
    cipher.getAuthTag()
  ]).toString('base64');

  return JSON.stringify({
    id: 'callback-id-1',
    create_time: '2026-06-14T08:00:00+08:00',
    event_type: 'TRANSACTION.SUCCESS',
    resource_type: 'encrypt-resource',
    resource: {
      algorithm: 'AEAD_AES_256_GCM',
      ciphertext: encrypted,
      associated_data: associatedData,
      nonce
    }
  });
}

describe('OrderWorkflowService persistence smoke', () => {
  const originalWechatPayPlatformPublicKeyPem = process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM;
  const originalWechatPayPlatformSerial = process.env.WECHAT_PAY_PLATFORM_SERIAL;
  const originalWechatPayApiV3Key = process.env.WECHAT_PAY_API_V3_KEY;
  const originalWechatMiniappAppId = process.env.WECHAT_MINIAPP_APP_ID;
  const originalWechatPayMerchantId = process.env.WECHAT_PAY_MERCHANT_ID;
  const originalWechatPayMode = process.env.WECHAT_PAY_MODE;

  afterEach(() => {
    if (originalWechatPayPlatformPublicKeyPem === undefined) {
      delete process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM;
    } else {
      process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM = originalWechatPayPlatformPublicKeyPem;
    }

    if (originalWechatPayPlatformSerial === undefined) {
      delete process.env.WECHAT_PAY_PLATFORM_SERIAL;
    } else {
      process.env.WECHAT_PAY_PLATFORM_SERIAL = originalWechatPayPlatformSerial;
    }

    if (originalWechatPayApiV3Key === undefined) {
      delete process.env.WECHAT_PAY_API_V3_KEY;
    } else {
      process.env.WECHAT_PAY_API_V3_KEY = originalWechatPayApiV3Key;
    }

    if (originalWechatMiniappAppId === undefined) {
      delete process.env.WECHAT_MINIAPP_APP_ID;
    } else {
      process.env.WECHAT_MINIAPP_APP_ID = originalWechatMiniappAppId;
    }

    if (originalWechatPayMerchantId === undefined) {
      delete process.env.WECHAT_PAY_MERCHANT_ID;
    } else {
      process.env.WECHAT_PAY_MERCHANT_ID = originalWechatPayMerchantId;
    }

    if (originalWechatPayMode === undefined) {
      delete process.env.WECHAT_PAY_MODE;
    } else {
      process.env.WECHAT_PAY_MODE = originalWechatPayMode;
    }
  });

  test('previewOrderQuote returns coupon-aware quote without creating order side effects', async () => {
    const repo: any = {
      tx: (fn: any) => fn(buildNonLegacyPaymentTx()),
      findStore: async () => ({ id: 's1', isActive: true }),
      findSkus: async () => [
        { id: 'sku1', isActive: true, priceCents: 1200, memberPrices: [], product: { isPublished: true, supportsPickup: true, supportsShipping: true } }
      ],
      findAvailability: async () => [{ skuId: 'sku1' }],
      createOrder: jest.fn(),
      insertOrderStatusLog: jest.fn()
    };

    const service = new OrderWorkflowService(repo, new OrderPricingService());
    const quote = await service.previewOrderQuote({
      storeId: 's1',
      fulfillmentType: 'SHIPPING',
      items: [{ skuId: 'sku1', quantity: 2 }],
      couponCode: 'WELCOME-1000'
    } as any);

    expect(quote.subtotalAmountCents).toBe(2400);
    expect(quote.discountAmountCents).toBe(1000);
    expect(quote.totalAmountCents).toBe(1400);
    expect(quote.appliedCouponCode).toBe('WELCOME-1000');
    expect(repo.createOrder).not.toHaveBeenCalled();
    expect(repo.insertOrderStatusLog).not.toHaveBeenCalled();
  });

  test('createOrder supports STORE_PICKUP minimal contract', async () => {
    const repo: any = {
      tx: (fn: any) => fn(buildNonLegacyPaymentTx()),
      findStore: async () => ({ id: 's1', isActive: true }),
      findSkus: async () => [
        { id: 'sku1', isActive: true, priceCents: 1200, memberPrices: [], product: { isPublished: true, supportsPickup: true, supportsShipping: true } }
      ],
      findAvailability: async () => [{ skuId: 'sku1' }],
      createOrder: async (_tx: any, data: any) => ({
        id: 'o1',
        orderNo: data.orderNo,
        status: 'PENDING_PAYMENT',
        totalAmountCents: 2400,
        fulfillmentType: 'STORE_PICKUP',
        pickupRecord: { pickupCode: '123456' }
      }),
      insertOrderStatusLog: async () => ({})
    };

    const service = new OrderWorkflowService(repo, new OrderPricingService());
    const created = await service.createOrder('customer-1', {
      storeId: 's1',
      fulfillmentType: 'STORE_PICKUP',
      pickupDate: new Date().toISOString(),
      pickupTimeSlot: '10:00-12:00',
      items: [{ skuId: 'sku1', quantity: 2 }]
    } as any);

    expect(created.status).toBe('PENDING_PAYMENT');
    expect(created.fulfillmentType).toBe('STORE_PICKUP');
    expect(created.pickupCode).toBeDefined();
  });

  test('createOrder applies valid coupon as order-level discount while keeping item unit price as list price', async () => {
    let capturedSubtotalAmountCents = 0;
    let capturedDiscountAmountCents = 0;
    let capturedTotalAmountCents = 0;
    let capturedAppliedCouponCode: string | null = null;
    let capturedItems: Array<{ quantity: number; unitPriceCents: number }> = [];

    const repo: any = {
      tx: (fn: any) => fn(buildNonLegacyPaymentTx()),
      findStore: async () => ({ id: 's1', isActive: true }),
      findSkus: async () => [
        { id: 'sku1', isActive: true, priceCents: 1200, memberPrices: [], product: { isPublished: true, supportsPickup: true, supportsShipping: true } }
      ],
      findAvailability: async () => [{ skuId: 'sku1' }],
      createOrder: async (_tx: any, data: any) => {
        capturedSubtotalAmountCents = data.subtotalAmountCents;
        capturedDiscountAmountCents = data.discountAmountCents;
        capturedTotalAmountCents = data.totalAmountCents;
        capturedAppliedCouponCode = data.appliedCouponCode ?? null;
        capturedItems = data.items.create;
        return {
          id: 'o-coupon',
          orderNo: data.orderNo,
          status: 'PENDING_PAYMENT',
          totalAmountCents: data.totalAmountCents,
          fulfillmentType: 'SHIPPING',
          pickupRecord: null
        };
      },
      insertOrderStatusLog: async () => ({})
    };

    const service = new OrderWorkflowService(repo, new OrderPricingService());
    const created = await service.createOrder('customer-1', {
      storeId: 's1',
      fulfillmentType: 'SHIPPING',
      items: [{ skuId: 'sku1', quantity: 2 }],
      couponCode: 'WELCOME-1000',
      shippingAddress: {
        receiverName: 'Alice',
        phone: '13100000000',
        province: 'P',
        city: 'C',
        district: 'D',
        detail: 'Road 1'
      }
    } as any);

    expect(created.totalAmountCents).toBe(1400);
    expect(capturedSubtotalAmountCents).toBe(2400);
    expect(capturedDiscountAmountCents).toBe(1000);
    expect(capturedTotalAmountCents).toBe(1400);
    expect(capturedAppliedCouponCode).toBe('WELCOME-1000');
    expect(capturedItems).toEqual([{ sku: { connect: { id: 'sku1' } }, quantity: 2, unitPriceCents: 1200 }]);
  });

  test('createOrder rejects invalid coupon before order side effects', async () => {
    const repo: any = {
      tx: (fn: any) => fn(buildNonLegacyPaymentTx()),
      findStore: async () => ({ id: 's1', isActive: true }),
      findSkus: async () => [
        { id: 'sku1', isActive: true, priceCents: 1200, memberPrices: [], product: { isPublished: true, supportsPickup: true, supportsShipping: true } }
      ],
      findAvailability: async () => [{ skuId: 'sku1' }],
      createOrder: jest.fn(),
      insertOrderStatusLog: jest.fn()
    };

    const service = new OrderWorkflowService(repo, new OrderPricingService());

    await expect(
      service.createOrder('customer-1', {
        storeId: 's1',
        fulfillmentType: 'SHIPPING',
        items: [{ skuId: 'sku1', quantity: 1 }],
        couponCode: 'INVALID-XXX',
        shippingAddress: {
          receiverName: 'Alice',
          phone: '13100000000',
          province: 'P',
          city: 'C',
          district: 'D',
          detail: 'Road 1'
        }
      } as any)
    ).rejects.toThrow('优惠码无效。');

    expect(repo.createOrder).not.toHaveBeenCalled();
    expect(repo.insertOrderStatusLog).not.toHaveBeenCalled();
  });

  test('createOrder requires shipping address for SHIPPING', async () => {
    const repo: any = {
      tx: (fn: any) => fn(buildNonLegacyPaymentTx()),
      findStore: async () => ({ id: 's1', isActive: true }),
      findSkus: async () => [
        { id: 'sku1', isActive: true, priceCents: 1200, memberPrices: [], product: { isPublished: true, supportsPickup: true, supportsShipping: true } }
      ],
      findAvailability: async () => [{ skuId: 'sku1' }]
    };

    const service = new OrderWorkflowService(repo, new OrderPricingService());
    await expect(
      service.createOrder('customer-1', {
        storeId: 's1',
        fulfillmentType: 'SHIPPING',
        items: [{ skuId: 'sku1', quantity: 1 }]
      } as any)
    ).rejects.toThrow('shippingAddress is required for SHIPPING');
  });

  test('markPaid uses durable paymentRef idempotency semantics', async () => {
    const payments = new Map<string, { orderId: string }>();
    const order = {
      id: 'o1',
      storeId: 's1',
      status: 'PENDING_PAYMENT',
      totalAmountCents: 100,
      fulfillmentType: 'SHIPPING',
      items: [{ skuId: 'sku-1', quantity: 1 }]
    };

    const repo: any = {
      tx: (fn: any) => fn(buildNonLegacyPaymentTx()),
      findPaymentByRef: async (_: any, paymentRef: string) => payments.get(paymentRef) ?? null,
      lockOrder: async () => ({}),
      getOrder: async () => order,
      lockInventoriesForOrder: async () => ({}),
      getInventoriesForOrder: async () => [{ id: 'inv-1', skuId: 'sku-1', availableStock: 2, reservedStock: 0, physicalStock: 2 }],
      createPaymentRecord: async (_: any, orderId: string, paymentRef: string) => {
        payments.set(paymentRef, { orderId });
      },
      updateInventory: async () => ({}),
      updateOrderStatus: async () => ({}),
      insertOrderStatusLog: async () => ({}),
      insertInventoryLogs: async () => ({})
    };

    const service = new OrderWorkflowService(repo, new OrderPricingService());

    const first = await service.markPaid('o1', 'p-ref', 100);
    const second = await service.markPaid('o1', 'p-ref', 100);

    expect(first.result).toBe('APPLIED');
    expect(second.result).toBe('IGNORED_DUPLICATE');
  });

  test('markPaid rejects amount mismatch before payment mutation', async () => {
    const repo: any = {
      tx: (fn: any) => fn(buildNonLegacyPaymentTx()),
      findPaymentByRef: async () => null,
      lockOrder: async () => ({}),
      getOrder: async () => ({
        id: 'o-amount-mismatch',
        storeId: 's1',
        status: 'PENDING_PAYMENT',
        totalAmountCents: 6800,
        fulfillmentType: 'SHIPPING',
        items: [{ skuId: 'sku-1', quantity: 1 }]
      }),
      createPaymentRecord: jest.fn(),
      updateInventory: jest.fn(),
      updateOrderStatus: jest.fn()
    };
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const service = new OrderWorkflowService(repo, new OrderPricingService());
    await expect(service.markPaid('o-amount-mismatch', 'wx-pay-mismatch-1', 6700)).rejects.toThrow(
      new BadRequestException('Payment amount does not match order total')
    );

    expect(repo.createPaymentRecord).not.toHaveBeenCalled();
    expect(repo.updateInventory).not.toHaveBeenCalled();
    expect(repo.updateOrderStatus).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith('Wechat payment amount mismatch rejected', {
      orderId: '***smatch',
      expectedAmountCents: 6800,
      actualAmountCents: 6700,
      paymentRef: '***smatch-1'
    });
    warnSpy.mockRestore();
  });

  test('markPaid rejects zero amount payment completion before mutation', async () => {
    const repo: any = {
      tx: (fn: any) => fn(buildNonLegacyPaymentTx()),
      findPaymentByRef: async () => null,
      lockOrder: async () => ({}),
      getOrder: async () => ({
        id: 'o-zero-amount',
        storeId: 's1',
        status: 'PENDING_PAYMENT',
        totalAmountCents: 0,
        fulfillmentType: 'SHIPPING',
        items: [{ skuId: 'sku-1', quantity: 1 }]
      }),
      createPaymentRecord: jest.fn(),
      updateInventory: jest.fn(),
      updateOrderStatus: jest.fn()
    };
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const service = new OrderWorkflowService(repo, new OrderPricingService());
    await expect(service.markPaid('o-zero-amount', 'wx-pay-zero-1', 0)).rejects.toThrow(
      new BadRequestException('Payment amount does not match order total')
    );

    expect(repo.createPaymentRecord).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  test('listOrders scopes CUSTOMER to own orders', async () => {
    const repo: any = {
      listOrders: jest.fn().mockResolvedValue([])
    };

    const service = new OrderWorkflowService(repo, new OrderPricingService());
    await service.listOrders({ role: UserRole.CUSTOMER, userId: 'customer-1' });

    expect(repo.listOrders).toHaveBeenCalledWith({ customerId: 'customer-1' });
  });

  test('getOrder rejects CUSTOMER access to another customer order', async () => {
    const repo: any = {
      getOrderDetail: async () => ({ id: 'o1', customerId: 'customer-2' })
    };

    const service = new OrderWorkflowService(repo, new OrderPricingService());

    await expect(service.getOrder('o1', { role: UserRole.CUSTOMER, userId: 'customer-1' })).rejects.toThrow(
      'You do not have access to this order'
    );
  });

  test('markPaid rejects CUSTOMER access to another customer order before mutating state', async () => {
    const repo: any = {
      tx: (fn: any) => fn(buildNonLegacyPaymentTx()),
      lockOrder: async () => ({}),
      getOrder: async () => ({
        id: 'o1',
        customerId: 'customer-2',
        storeId: 's1',
        status: 'PENDING_PAYMENT',
        fulfillmentType: 'SHIPPING',
        items: [{ skuId: 'sku-1', quantity: 1 }]
      }),
      findPaymentByRef: async () => null,
      createPaymentRecord: jest.fn()
    };

    const service = new OrderWorkflowService(repo, new OrderPricingService());

    await expect(
      service.markPaid('o1', 'pay-ref', 100, { role: UserRole.CUSTOMER, userId: 'customer-1' })
    ).rejects.toThrow('You do not have access to this order');
    expect(repo.createPaymentRecord).not.toHaveBeenCalled();
  });

  test('createMiniappPayment returns a real wechat initiation response for eligible customer order', async () => {
    const repo: any = {
      getOrderDetail: async () => ({
        id: 'o-pay-1',
        orderNo: 'SO-PAY-1',
        customerId: 'wechat:openid-pay-1',
        status: 'PENDING_PAYMENT',
        totalAmountCents: 12800
      }),
      // Phase 2.48K-fix：createMiniappPayment 现用 repo.tx + isFreshPreorderOrder 真实内容判定；dry 订单 fresh 计数=0。
      tx: async (cb: any) => cb(buildNonLegacyPaymentTx())
    };
    const paymentCreateClient: any = {
      createMiniappPayment: jest.fn().mockResolvedValue({
        launchParams: {
          timeStamp: '1712563200',
          nonceStr: 'nonce-pay-1',
          package: 'prepay_id=wx-prepay-1',
          signType: 'RSA',
          paySign: 'signature-pay-1'
        }
      })
    };

    const service = new OrderWorkflowService(repo, new OrderPricingService(), undefined, undefined, undefined, undefined, paymentCreateClient);
    const result = await service.createMiniappPayment('o-pay-1', { role: UserRole.CUSTOMER, userId: 'wechat:openid-pay-1' });

    expect(paymentCreateClient.createMiniappPayment).toHaveBeenCalledWith({
      orderNo: 'SO-PAY-1',
      totalAmountCents: 12800,
      openId: 'openid-pay-1'
    });
    expect(result).toEqual({
      provider: 'wechat',
      initiationType: 'MINIAPP',
      orderId: 'o-pay-1',
      orderNo: 'SO-PAY-1',
      totalAmountCents: 12800,
      launchParams: {
        timeStamp: '1712563200',
        nonceStr: 'nonce-pay-1',
        package: 'prepay_id=wx-prepay-1',
        signType: 'RSA',
        paySign: 'signature-pay-1'
      }
    });
  });

  test('createMiniappPayment rejects non-pending-payment order before any provider work', async () => {
    const repo: any = {
      getOrderDetail: async () => ({
        id: 'o-pay-2',
        orderNo: 'SO-PAY-2',
        customerId: 'wechat:openid-pay-2',
        status: 'PAID_PENDING_SHIPMENT',
        totalAmountCents: 12800
      }),
      // Phase 2.48K-fix：createMiniappPayment 现用 repo.tx + isFreshPreorderOrder 真实内容判定；dry 订单 fresh 计数=0。
      tx: async (cb: any) => cb(buildNonLegacyPaymentTx())
    };

    const service = new OrderWorkflowService(repo, new OrderPricingService());

    await expect(service.createMiniappPayment('o-pay-2', { role: UserRole.CUSTOMER, userId: 'wechat:openid-pay-2' })).rejects.toThrow(
      'Miniapp payment creation only allowed from PENDING_PAYMENT'
    );
  });

  test('createMiniappPayment rejects CUSTOMER access to another customer order', async () => {
    const repo: any = {
      getOrderDetail: async () => ({
        id: 'o-pay-3',
        orderNo: 'SO-PAY-3',
        customerId: 'wechat:openid-pay-3-other',
        status: 'PENDING_PAYMENT',
        totalAmountCents: 12800
      })
    };

    const service = new OrderWorkflowService(repo, new OrderPricingService());

    await expect(
      service.createMiniappPayment('o-pay-3', { role: UserRole.CUSTOMER, userId: 'wechat:openid-pay-3' })
    ).rejects.toThrow('You do not have access to this order');
  });

  test('handleMiniappPaymentCallback verifies wechat callback and completes payment through markPaid', async () => {
    const repo: any = {
      findOrderByOrderNo: async () => ({ id: 'o-callback-1', orderNo: 'SO-20260408-1' }),
      tx: (fn: any) => fn(buildNonLegacyPaymentTx()),
      lockOrder: async () => ({}),
      getOrder: async () => ({
        id: 'o-callback-1',
        storeId: 's1',
        status: 'PENDING_PAYMENT',
        totalAmountCents: 12800,
        fulfillmentType: 'SHIPPING',
        items: [{ skuId: 'sku-1', quantity: 1 }]
      }),
      findPaymentByRef: async () => null,
      lockInventoriesForOrder: async () => ({}),
      getInventoriesForOrder: async () => [{ id: 'inv-1', skuId: 'sku-1', availableStock: 2, reservedStock: 0, physicalStock: 2 }],
      createPaymentRecord: jest.fn(),
      updateInventory: async () => ({}),
      updateOrderStatus: async () => ({}),
      insertOrderStatusLog: async () => ({}),
      insertInventoryLogs: async () => ({})
    };
    const service = new OrderWorkflowService(repo, new OrderPricingService());
    const rawBody = '{"merchantOrderNo":"SO-20260408-1","transactionId":"wx-tx-1001","paidAmountCents":12800}';
    const fixture = buildSignedWechatCallbackVerificationFixture(rawBody);
    process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM = fixture.env.publicKeyPem;
    process.env.WECHAT_PAY_PLATFORM_SERIAL = fixture.env.serial;

    const result = await service.handleMiniappPaymentCallback(
      {
        provider: 'wechat',
        callbackPayload: JSON.parse(rawBody),
        raw: { source: 'callback-signature-test' }
      } as any,
      fixture.input
    );

    expect(result).toEqual({
      stage: 'CALLBACK_COMPLETION',
      provider: 'wechat',
      status: 'APPLIED',
      orderId: 'o-callback-1',
      orderNo: 'SO-20260408-1',
      paymentRef: 'wx-tx-1001',
      paidAmountCents: 12800,
      message: 'Verified callback payment applied'
    });
    expect(repo.createPaymentRecord).toHaveBeenCalledWith(expect.any(Object), 'o-callback-1', 'wx-tx-1001', 12800);
  });

  test('handleMiniappPaymentCallback returns callback-safe duplicate acknowledgment for same-order duplicate paymentRef', async () => {
    const repo: any = {
      findOrderByOrderNo: async () => ({ id: 'o-callback-2', orderNo: 'SO-20260408-2' }),
      tx: (fn: any) => fn(buildNonLegacyPaymentTx()),
      lockOrder: async () => ({}),
      getOrder: async () => ({
        id: 'o-callback-2',
        storeId: 's1',
        status: 'PENDING_PAYMENT',
        totalAmountCents: 6400,
        fulfillmentType: 'SHIPPING',
        items: [{ skuId: 'sku-1', quantity: 1 }]
      }),
      findPaymentByRef: async () => ({ orderId: 'o-callback-2' }),
      createPaymentRecord: jest.fn()
    };
    const service = new OrderWorkflowService(repo, new OrderPricingService());
    const rawBody = '{"merchantOrderNo":"SO-20260408-2","transactionId":"wx-tx-1002","paidAmountCents":6400}';
    const fixture = buildSignedWechatCallbackVerificationFixture(rawBody);
    process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM = fixture.env.publicKeyPem;
    process.env.WECHAT_PAY_PLATFORM_SERIAL = fixture.env.serial;

    const result = await service.handleMiniappPaymentCallback(
      {
        provider: 'wechat',
        callbackPayload: JSON.parse(rawBody)
      } as any,
      fixture.input
    );

    expect(result).toEqual({
      stage: 'CALLBACK_COMPLETION',
      provider: 'wechat',
      status: 'IGNORED_DUPLICATE',
      orderId: 'o-callback-2',
      orderNo: 'SO-20260408-2',
      paymentRef: 'wx-tx-1002',
      paidAmountCents: 6400,
      message: 'Verified callback duplicate acknowledged'
    });
    expect(repo.createPaymentRecord).not.toHaveBeenCalled();
  });

  test('handleMiniappPaymentCallback fails honestly when verified orderNo cannot be resolved', async () => {
    const repo: any = {
      findOrderByOrderNo: async () => null
    };
    const service = new OrderWorkflowService(repo, new OrderPricingService());
    const rawBody = '{"merchantOrderNo":"SO-MISSING","transactionId":"wx-tx-missing","paidAmountCents":12800}';
    const fixture = buildSignedWechatCallbackVerificationFixture(rawBody);
    process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM = fixture.env.publicKeyPem;
    process.env.WECHAT_PAY_PLATFORM_SERIAL = fixture.env.serial;

    await expect(
      service.handleMiniappPaymentCallback(
        {
          provider: 'wechat',
          callbackPayload: JSON.parse(rawBody)
        } as any,
        fixture.input
      )
    ).rejects.toThrow(new NotFoundException('Order not found for verified callback orderNo'));
  });

  test('handleMiniappPaymentCallback fails honestly for cross-order duplicate paymentRef conflict', async () => {
    const repo: any = {
      findOrderByOrderNo: async () => ({ id: 'o-callback-3', orderNo: 'SO-20260408-3' }),
      tx: (fn: any) => fn(buildNonLegacyPaymentTx()),
      lockOrder: async () => ({}),
      getOrder: async () => ({
        id: 'o-callback-3',
        storeId: 's1',
        status: 'PENDING_PAYMENT',
        totalAmountCents: 3200,
        fulfillmentType: 'SHIPPING',
        items: [{ skuId: 'sku-1', quantity: 1 }]
      }),
      findPaymentByRef: async () => ({ orderId: 'o-other' })
    };
    const service = new OrderWorkflowService(repo, new OrderPricingService());
    const rawBody = '{"merchantOrderNo":"SO-20260408-3","transactionId":"wx-tx-1003","paidAmountCents":3200}';
    const fixture = buildSignedWechatCallbackVerificationFixture(rawBody);
    process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM = fixture.env.publicKeyPem;
    process.env.WECHAT_PAY_PLATFORM_SERIAL = fixture.env.serial;

    await expect(
      service.handleMiniappPaymentCallback(
        {
          provider: 'wechat',
          callbackPayload: JSON.parse(rawBody)
        } as any,
        fixture.input
      )
    ).rejects.toThrow(new BadRequestException('Duplicate paymentRef used for a different order'));
  });

  test('handleMiniappPaymentCallback fails honestly for invalid payment completion transition after verification', async () => {
    const repo: any = {
      findOrderByOrderNo: async () => ({ id: 'o-callback-4', orderNo: 'SO-20260408-4' }),
      tx: (fn: any) => fn(buildNonLegacyPaymentTx()),
      lockOrder: async () => ({}),
      getOrder: async () => ({
        id: 'o-callback-4',
        storeId: 's1',
        status: 'PAID_PENDING_SHIPMENT',
        fulfillmentType: 'SHIPPING',
        items: [{ skuId: 'sku-1', quantity: 1 }]
      }),
      findPaymentByRef: async () => null
    };
    const service = new OrderWorkflowService(repo, new OrderPricingService());
    const rawBody = '{"merchantOrderNo":"SO-20260408-4","transactionId":"wx-tx-1004","paidAmountCents":1600}';
    const fixture = buildSignedWechatCallbackVerificationFixture(rawBody);
    process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM = fixture.env.publicKeyPem;
    process.env.WECHAT_PAY_PLATFORM_SERIAL = fixture.env.serial;

    await expect(
      service.handleMiniappPaymentCallback(
        {
          provider: 'wechat',
          callbackPayload: JSON.parse(rawBody)
        } as any,
        fixture.input
      )
    ).rejects.toThrow(new BadRequestException('Invalid transition: payment only allowed from PENDING_PAYMENT'));
  });

  test('handleMiniappPaymentCallback decrypts native Wechat v3 resource and applies SUCCESS once', async () => {
    process.env.WECHAT_PAY_API_V3_KEY = TEST_WECHAT_PAY_API_V3_KEY;
    process.env.WECHAT_PAY_MODE = 'direct';
    process.env.WECHAT_MINIAPP_APP_ID = 'wx-test-appid';
    process.env.WECHAT_PAY_MERCHANT_ID = '1900000109';

    const repo: any = {
      findOrderByOrderNo: async () => ({ id: 'o-callback-v3-1', orderNo: 'SO-V3-1' }),
      tx: (fn: any) => fn(buildNonLegacyPaymentTx()),
      lockOrder: async () => ({}),
      getOrder: async () => ({
        id: 'o-callback-v3-1',
        storeId: 's1',
        status: 'PENDING_PAYMENT',
        totalAmountCents: 5900,
        fulfillmentType: 'SHIPPING',
        items: [{ skuId: 'sku-1', quantity: 1 }]
      }),
      findPaymentByRef: async () => null,
      lockInventoriesForOrder: async () => ({}),
      getInventoriesForOrder: async () => [{ id: 'inv-1', skuId: 'sku-1', availableStock: 2, reservedStock: 0, physicalStock: 2 }],
      createPaymentRecord: jest.fn(),
      updateInventory: async () => ({}),
      updateOrderStatus: async () => ({}),
      insertOrderStatusLog: async () => ({}),
      insertInventoryLogs: async () => ({})
    };
    const service = new OrderWorkflowService(repo, new OrderPricingService());
    const rawBody = buildEncryptedWechatResourceCallbackBody({
      appid: 'wx-test-appid',
      mchid: '1900000109',
      out_trade_no: 'SO-V3-1',
      transaction_id: 'wx-native-transaction-1001',
      trade_state: 'SUCCESS',
      amount: { total: 5900, currency: 'CNY' }
    });
    const fixture = buildSignedWechatCallbackVerificationFixture(rawBody);
    process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM = fixture.env.publicKeyPem;
    process.env.WECHAT_PAY_PLATFORM_SERIAL = fixture.env.serial;

    const result = await service.handleMiniappPaymentCallback(
      {
        provider: 'wechat',
        callbackPayload: JSON.parse(rawBody)
      } as any,
      fixture.input
    );

    expect(result.status).toBe('APPLIED');
    expect(result.paymentRef).toBe('wx-native-transaction-1001');
    expect(result.paidAmountCents).toBe(5900);
    expect(repo.createPaymentRecord).toHaveBeenCalledWith(expect.any(Object), 'o-callback-v3-1', 'wx-native-transaction-1001', 5900);
  });

  test('handleMiniappPaymentCallback rejects native Wechat v3 non-SUCCESS trade state', async () => {
    process.env.WECHAT_PAY_API_V3_KEY = TEST_WECHAT_PAY_API_V3_KEY;
    const service = new OrderWorkflowService({} as any, new OrderPricingService());
    const rawBody = buildEncryptedWechatResourceCallbackBody({
      out_trade_no: 'SO-V3-NOTPAY',
      transaction_id: 'wx-native-transaction-notpay',
      trade_state: 'NOTPAY',
      amount: { total: 5900, currency: 'CNY' }
    });
    const fixture = buildSignedWechatCallbackVerificationFixture(rawBody);
    process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM = fixture.env.publicKeyPem;
    process.env.WECHAT_PAY_PLATFORM_SERIAL = fixture.env.serial;

    await expect(
      service.handleMiniappPaymentCallback(
        {
          provider: 'wechat',
          callbackPayload: JSON.parse(rawBody)
        } as any,
        fixture.input
      )
    ).rejects.toThrow(new BadRequestException('Wechat payment trade_state is not SUCCESS: NOTPAY'));
  });

  test('MiniappPaymentCallbackVerificationService rejects native Wechat v3 resource decrypt with wrong key', () => {
    process.env.WECHAT_PAY_API_V3_KEY = 'abcdefghijklmnopqrstuvwxzy123456';
    const verification = new MiniappPaymentCallbackVerificationService();
    const rawBody = buildEncryptedWechatResourceCallbackBody({
      out_trade_no: 'SO-V3-WRONG-KEY',
      transaction_id: 'wx-native-transaction-wrong-key',
      trade_state: 'SUCCESS',
      amount: { total: 5900, currency: 'CNY' }
    });

    expect(() =>
      verification.extractWechatCallbackPayloadForBusinessMapping(JSON.parse(rawBody))
    ).toThrow(new BadRequestException('Wechat callback resource decrypt failed'));
  });

  test('handleMiniappPaymentCallback rejects native Wechat v3 amount mismatch before mutation', async () => {
    process.env.WECHAT_PAY_API_V3_KEY = TEST_WECHAT_PAY_API_V3_KEY;
    const repo: any = {
      findOrderByOrderNo: async () => ({ id: 'o-callback-v3-mismatch', orderNo: 'SO-V3-MISMATCH' }),
      tx: (fn: any) => fn(buildNonLegacyPaymentTx()),
      lockOrder: async () => ({}),
      getOrder: async () => ({
        id: 'o-callback-v3-mismatch',
        storeId: 's1',
        status: 'PENDING_PAYMENT',
        totalAmountCents: 6800,
        fulfillmentType: 'SHIPPING',
        items: [{ skuId: 'sku-1', quantity: 1 }]
      }),
      findPaymentByRef: async () => null,
      createPaymentRecord: jest.fn(),
      updateInventory: jest.fn(),
      updateOrderStatus: jest.fn()
    };
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const service = new OrderWorkflowService(repo, new OrderPricingService());
    const rawBody = buildEncryptedWechatResourceCallbackBody({
      out_trade_no: 'SO-V3-MISMATCH',
      transaction_id: 'wx-native-transaction-mismatch',
      trade_state: 'SUCCESS',
      amount: { total: 6700, currency: 'CNY' }
    });
    const fixture = buildSignedWechatCallbackVerificationFixture(rawBody);
    process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM = fixture.env.publicKeyPem;
    process.env.WECHAT_PAY_PLATFORM_SERIAL = fixture.env.serial;

    await expect(
      service.handleMiniappPaymentCallback(
        {
          provider: 'wechat',
          callbackPayload: JSON.parse(rawBody)
        } as any,
        fixture.input
      )
    ).rejects.toThrow(new BadRequestException('Payment amount does not match order total'));

    expect(repo.createPaymentRecord).not.toHaveBeenCalled();
    expect(repo.updateInventory).not.toHaveBeenCalled();
    expect(repo.updateOrderStatus).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  test('handleMiniappPaymentCallback rejects unsupported provider before verification stage', async () => {
    const service = new OrderWorkflowService({} as any, new OrderPricingService());

    await expect(
      service.handleMiniappPaymentCallback(
        {
          provider: 'mockpay',
          callbackPayload: { transactionId: 'tx-unsupported' }
        } as any,
        {
          rawBody: '{"transactionId":"tx-unsupported"}',
          wechatpayTimestamp: '1712563200',
          wechatpayNonce: 'nonce',
          wechatpaySerial: 'serial',
          wechatpaySignature: 'signature'
        }
      )
    ).rejects.toThrow(new BadRequestException('Unsupported miniapp payment callback provider: mockpay'));
  });

  test('MiniappPaymentCallbackVerificationService builds structured verification attempt for wechat payload', () => {
    const verification = new MiniappPaymentCallbackVerificationService();

    expect(
      verification.buildVerificationAttempt({
        provider: 'wechat',
        callbackPayload: {
          transactionId: 'tx-structured-1',
          outTradeNo: 'order-ref-1'
        },
        raw: {
          source: 'verification-service-test'
        }
      } as any)
    ).toEqual({
      stage: 'CALLBACK_VERIFICATION',
      provider: 'wechat',
      status: 'NOT_IMPLEMENTED',
      callbackPayload: {
        transactionId: 'tx-structured-1',
        outTradeNo: 'order-ref-1'
      },
      raw: {
        source: 'verification-service-test'
      },
      message: 'Miniapp payment callback verification is not implemented yet'
    });
  });

  test('MiniappPaymentCallbackVerificationService verifies a real wechat callback signature', () => {
    const rawBody = '{"merchantOrderNo":"SO-20260408-4","transactionId":"wx-tx-1004","paidAmountCents":6400}';
    const fixture = buildSignedWechatCallbackVerificationFixture(rawBody);
    process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM = fixture.env.publicKeyPem;
    process.env.WECHAT_PAY_PLATFORM_SERIAL = fixture.env.serial;

    const verification = new MiniappPaymentCallbackVerificationService();

    expect(
      verification.verifyWechatCallbackSignature(JSON.parse(rawBody), fixture.input)
    ).toEqual({
      provider: 'wechat',
      callbackPayload: {
        merchantOrderNo: 'SO-20260408-4',
        transactionId: 'wx-tx-1004',
        paidAmountCents: 6400
      }
    });
  });

  test('MiniappPaymentCallbackVerificationService fails honestly when payment verification config is missing', () => {
    delete process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM;
    delete process.env.WECHAT_PAY_PLATFORM_SERIAL;

    const verification = new MiniappPaymentCallbackVerificationService();

    expect(() =>
      verification.verifyWechatCallbackSignature(
        {},
        {
          rawBody: '{}',
          wechatpayTimestamp: '1712563200',
          wechatpayNonce: 'nonce',
          wechatpaySerial: 'serial',
          wechatpaySignature: 'signature'
        }
      )
    ).toThrow(new InternalServerErrorException('WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM is not configured'));
  });

  test('MiniappPaymentCallbackVerificationService rejects mismatched platform serial before business mapping', () => {
    const rawBody = '{"merchantOrderNo":"SO-20260408-5","transactionId":"wx-tx-1005","paidAmountCents":3200}';
    const fixture = buildSignedWechatCallbackVerificationFixture(rawBody);
    process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM = fixture.env.publicKeyPem;
    process.env.WECHAT_PAY_PLATFORM_SERIAL = 'wechatpay-platform-serial-other';

    const verification = new MiniappPaymentCallbackVerificationService();

    expect(() =>
      verification.verifyWechatCallbackSignature(JSON.parse(rawBody), fixture.input)
    ).toThrow(new UnauthorizedException('Wechat callback platform serial mismatch'));
  });

  test('MiniappPaymentCallbackVerificationService rejects invalid wechat callback signature before business mapping', () => {
    const rawBody = '{"merchantOrderNo":"SO-20260408-6","transactionId":"wx-tx-1006","paidAmountCents":1600}';
    const fixture = buildSignedWechatCallbackVerificationFixture(rawBody);
    process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM = fixture.env.publicKeyPem;
    process.env.WECHAT_PAY_PLATFORM_SERIAL = fixture.env.serial;

    const verification = new MiniappPaymentCallbackVerificationService();

    expect(() =>
      verification.verifyWechatCallbackSignature(JSON.parse(rawBody), {
        ...fixture.input,
        wechatpaySignature: `${fixture.input.wechatpaySignature.slice(0, -2)}aa`
      })
    ).toThrow(new UnauthorizedException('Wechat callback signature verification failed'));
  });

  test('MiniappPaymentCallbackVerificationService maps verified wechat callback payload to business input', () => {
    const verification = new MiniappPaymentCallbackVerificationService();

    expect(
      verification.mapVerifiedWechatCallbackToBusinessInput({
        merchantOrderNo: 'SO-20260408-1',
        transactionId: 'wx-tx-1001',
        paidAmountCents: 12800,
        raw: {
          attachOnlyForDebug: true,
          bankType: 'CMB'
        }
      })
    ).toEqual({
      orderNo: 'SO-20260408-1',
      paymentRef: 'wx-tx-1001',
      paidAmountCents: 12800
    });
  });

  test('MiniappPaymentCallbackVerificationService extracts verification-relevant fields from wechat callback payload', () => {
    const verification = new MiniappPaymentCallbackVerificationService();

    expect(
      verification.extractWechatCallbackPayloadForBusinessMapping({
        merchantOrderNo: 'SO-20260408-2',
        transactionId: 'wx-tx-1002',
        paidAmountCents: 25600,
        bankType: 'CMB',
        attach: 'debug-only'
      })
    ).toEqual({
      merchantOrderNo: 'SO-20260408-2',
      transactionId: 'wx-tx-1002',
      paidAmountCents: 25600
    });
  });

  test('MiniappPaymentCallbackVerificationService maps native Wechat v3 decrypted fields to business payload', () => {
    process.env.WECHAT_PAY_API_V3_KEY = TEST_WECHAT_PAY_API_V3_KEY;
    const verification = new MiniappPaymentCallbackVerificationService();
    const rawBody = buildEncryptedWechatResourceCallbackBody({
      out_trade_no: 'SO-V3-2',
      transaction_id: 'wx-native-transaction-1002',
      trade_state: 'SUCCESS',
      amount: { total: 8800, currency: 'CNY' }
    });

    expect(verification.extractWechatCallbackPayloadForBusinessMapping(JSON.parse(rawBody))).toEqual({
      merchantOrderNo: 'SO-V3-2',
      transactionId: 'wx-native-transaction-1002',
      paidAmountCents: 8800
    });
  });

  test('MiniappPaymentCallbackVerificationService fails honestly when extraction fields are missing', () => {
    const verification = new MiniappPaymentCallbackVerificationService();

    expect(() =>
      verification.extractWechatCallbackPayloadForBusinessMapping({
        transactionId: 'wx-tx-missing-order',
        paidAmountCents: 25600
      })
    ).toThrow(new BadRequestException('Wechat callback payload missing merchantOrderNo'));
  });

  test('MiniappPaymentCallbackVerificationService supports a local extraction-to-business-mapping seam without payment completion', () => {
    const verification = new MiniappPaymentCallbackVerificationService();
    const extracted = verification.extractWechatCallbackPayloadForBusinessMapping({
      merchantOrderNo: 'SO-20260408-3',
      transactionId: 'wx-tx-1003',
      paidAmountCents: 51200,
      settlementTotalCents: 51200
    });

    expect(verification.mapVerifiedWechatCallbackToBusinessInput(extracted)).toEqual({
      orderNo: 'SO-20260408-3',
      paymentRef: 'wx-tx-1003',
      paidAmountCents: 51200
    });
  });

  test('cancelOrder rejects CUSTOMER access to another customer order before mutating state', async () => {
    const repo: any = {
      tx: (fn: any) => fn(buildNonLegacyPaymentTx()),
      lockOrder: async () => ({}),
      getOrder: async () => ({
        id: 'o1',
        customerId: 'customer-2',
        storeId: 's1',
        status: 'PENDING_PAYMENT',
        items: []
      }),
      updateOrderStatus: jest.fn()
    };

    const service = new OrderWorkflowService(repo, new OrderPricingService());

    await expect(service.cancelOrder('o1', { role: UserRole.CUSTOMER, userId: 'customer-1' })).rejects.toThrow(
      'You do not have access to this order'
    );
    expect(repo.updateOrderStatus).not.toHaveBeenCalled();
  });
});
