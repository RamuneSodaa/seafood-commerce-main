import { BadRequestException, InternalServerErrorException, ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv } from 'crypto';
import { AdminRole } from '@prisma/client';
import { OrderWorkflowService } from '../src/modules/orders/order-workflow.service';
import { MiniappPaymentCallbackVerificationService } from '../src/modules/orders/miniapp-payment-callback-verification.service';
import { assertWechatLivePaymentEnabled, readPaymentRuntimeMode } from '../src/modules/orders/payment-runtime-mode';
import { OrderPricingService } from '../src/modules/pricing/order-pricing.service';

const TEST_API_V3_KEY = '12345678901234567890123456789012';

function encryptedCallback(payload: Record<string, unknown>) {
  const associatedData = 'transaction';
  const nonce = 'p2d1a-nonce';
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(TEST_API_V3_KEY, 'utf8'), Buffer.from(nonce, 'utf8'));
  cipher.setAAD(Buffer.from(associatedData, 'utf8'));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
    cipher.getAuthTag()
  ]).toString('base64');
  return {
    id: 'p2d1a-callback',
    event_type: 'TRANSACTION.SUCCESS',
    resource: {
      algorithm: 'AEAD_AES_256_GCM',
      ciphertext,
      associated_data: associatedData,
      nonce
    }
  };
}

describe('P2D1A-R1 payment and store-scope security hardening', () => {
  const originalRuntimeMode = process.env.PAYMENT_RUNTIME_MODE;
  const originalWechatMode = process.env.WECHAT_PAY_MODE;
  const originalApiV3Key = process.env.WECHAT_PAY_API_V3_KEY;
  const originalAppId = process.env.WECHAT_MINIAPP_APP_ID;
  const originalMerchantId = process.env.WECHAT_PAY_MERCHANT_ID;

  afterEach(() => {
    const restore = (name: string, value: string | undefined) => {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    };
    restore('PAYMENT_RUNTIME_MODE', originalRuntimeMode);
    restore('WECHAT_PAY_MODE', originalWechatMode);
    restore('WECHAT_PAY_API_V3_KEY', originalApiV3Key);
    restore('WECHAT_MINIAPP_APP_ID', originalAppId);
    restore('WECHAT_PAY_MERCHANT_ID', originalMerchantId);
  });

  test('payment runtime defaults to disabled and fails closed', () => {
    delete process.env.PAYMENT_RUNTIME_MODE;
    expect(readPaymentRuntimeMode()).toBe('disabled');
    expect(() => assertWechatLivePaymentEnabled()).toThrow(
      new ServiceUnavailableException('PAYMENT_RUNTIME_DISABLED: 微信支付暂未开放')
    );
  });

  test('payment runtime only accepts the exact wechat_live value', () => {
    process.env.PAYMENT_RUNTIME_MODE = 'wechat_live';
    expect(readPaymentRuntimeMode()).toBe('wechat_live');
    expect(() => assertWechatLivePaymentEnabled()).not.toThrow();

    process.env.PAYMENT_RUNTIME_MODE = 'wechat-live';
    expect(() => readPaymentRuntimeMode()).toThrow(
      new ServiceUnavailableException('PAYMENT_RUNTIME_MODE_INVALID: payment remains disabled')
    );
  });

  test('createMiniappPayment stops before reading an order when runtime is disabled', async () => {
    delete process.env.PAYMENT_RUNTIME_MODE;
    const repo = { getOrderDetail: jest.fn() } as any;
    const service = new OrderWorkflowService(repo, new OrderPricingService());

    await expect(service.createMiniappPayment('order-disabled')).rejects.toThrow(
      'PAYMENT_RUNTIME_DISABLED'
    );
    expect(repo.getOrderDetail).not.toHaveBeenCalled();
  });

  test('store staff cannot read another store order notes', async () => {
    const repo = {
      findOrderById: jest.fn().mockResolvedValue({ id: 'o-other', customerId: 'c1', storeId: 'store-b' }),
      listOrderNotes: jest.fn()
    } as any;
    const service = new OrderWorkflowService(repo, new OrderPricingService());

    await expect(
      service.listOrderNotes('o-other', {
        role: AdminRole.STORE_STAFF,
        adminId: 'staff-a',
        storeId: 'store-a'
      })
    ).rejects.toThrow('Store staff cannot access another store order');
    expect(repo.listOrderNotes).not.toHaveBeenCalled();
  });

  test('store staff cannot add or delete another store order notes', async () => {
    const repo = {
      findOrderById: jest.fn().mockResolvedValue({ id: 'o-other', customerId: 'c1', storeId: 'store-b' }),
      createOrderNote: jest.fn(),
      findOrderNoteById: jest.fn(),
      softDeleteOrderNote: jest.fn()
    } as any;
    const service = new OrderWorkflowService(repo, new OrderPricingService());
    const actor = { role: AdminRole.STORE_STAFF, adminId: 'staff-a', storeId: 'store-a' };

    await expect(service.addOrderNote('o-other', 'x', 'internal', 'staff-a', actor)).rejects.toThrow(
      'Store staff cannot access another store order'
    );
    await expect(service.softDeleteOrderNote('o-other', 'note-1', 'staff-a', undefined, actor)).rejects.toThrow(
      'Store staff cannot access another store order'
    );
    expect(repo.createOrderNote).not.toHaveBeenCalled();
    expect(repo.findOrderNoteById).not.toHaveBeenCalled();
    expect(repo.softDeleteOrderNote).not.toHaveBeenCalled();
  });

  test('store staff cannot confirm another store fresh preorder', async () => {
    const update = jest.fn();
    const tx = {
      orderItem: { count: jest.fn().mockResolvedValue(1) },
      freshPreorderDetail: {
        findUnique: jest.fn().mockResolvedValue({ stage: 'PENDING_STORE_CONFIRMATION' }),
        update
      }
    } as any;
    const repo = {
      tx: (fn: any) => fn(tx),
      lockOrder: jest.fn(),
      getOrder: jest.fn().mockResolvedValue({ id: 'o-fresh', orderNo: 'FP-1', customerId: 'c1', storeId: 'store-b' })
    } as any;
    const service = new OrderWorkflowService(repo, new OrderPricingService());

    await expect(
      service.confirmFreshPreorder(
        'o-fresh',
        { role: AdminRole.STORE_STAFF, adminId: 'staff-a', storeId: 'store-a' },
        { actualWeightJin: 1, finalTotalCents: 1000 },
        true
      )
    ).rejects.toThrow('Store staff cannot access another store order');
    expect(update).not.toHaveBeenCalled();
  });

  test('store staff cannot complete another store fresh preorder', async () => {
    const update = jest.fn();
    const tx = {
      orderItem: { count: jest.fn().mockResolvedValue(1) },
      freshPreorderDetail: {
        findUnique: jest.fn().mockResolvedValue({ stage: 'CONFIRMED_WAITING_PICKUP' }),
        update
      }
    } as any;
    const repo = {
      tx: (fn: any) => fn(tx),
      lockOrder: jest.fn(),
      getOrder: jest.fn().mockResolvedValue({ id: 'o-fresh-complete', orderNo: 'FP-2', customerId: 'c1', storeId: 'store-b' })
    } as any;
    const service = new OrderWorkflowService(repo, new OrderPricingService());

    await expect(
      service.completeFreshPreorder(
        'o-fresh-complete',
        { role: AdminRole.STORE_STAFF, adminId: 'staff-a', storeId: 'store-a' },
        true
      )
    ).rejects.toThrow('Store staff cannot access another store order');
    expect(update).not.toHaveBeenCalled();
  });

  test('store staff cannot cancel another store fresh preorder', async () => {
    const update = jest.fn();
    const tx = {
      orderItem: { count: jest.fn().mockResolvedValue(1) },
      freshPreorderDetail: {
        findUnique: jest.fn().mockResolvedValue({ stage: 'PENDING_STORE_CONFIRMATION' }),
        update
      }
    } as any;
    const repo = {
      tx: (fn: any) => fn(tx),
      lockOrder: jest.fn(),
      getOrder: jest.fn().mockResolvedValue({ id: 'o-fresh-cancel', orderNo: 'FP-3', customerId: 'c1', storeId: 'store-b' })
    } as any;
    const service = new OrderWorkflowService(repo, new OrderPricingService());

    await expect(
      service.cancelFreshPreorder(
        'o-fresh-cancel',
        { role: AdminRole.STORE_STAFF, adminId: 'staff-a', storeId: 'store-a' },
        'test',
        true
      )
    ).rejects.toThrow('Store staff cannot access another store order');
    expect(update).not.toHaveBeenCalled();
  });

  test('public callback envelope must contain a native encrypted resource', () => {
    const verification = new MiniappPaymentCallbackVerificationService();

    expect(() =>
      verification.assertNativeWechatTransactionCallbackEnvelope({
        merchantOrderNo: 'SO-NON-NATIVE-1',
        transactionId: 'TX-NON-NATIVE-1',
        paidAmountCents: 100
      })
    ).toThrow(new BadRequestException('Wechat callback missing encrypted resource'));
  });

  test('native callback requires trade_state SUCCESS and bound merchant identity', () => {
    process.env.WECHAT_PAY_API_V3_KEY = TEST_API_V3_KEY;
    process.env.WECHAT_PAY_MODE = 'direct';
    process.env.WECHAT_MINIAPP_APP_ID = 'wx-app';
    process.env.WECHAT_PAY_MERCHANT_ID = 'merchant-1';
    const verification = new MiniappPaymentCallbackVerificationService();

    expect(() => verification.extractWechatCallbackPayloadForBusinessMapping(encryptedCallback({
      appid: 'wx-app',
      mchid: 'merchant-1',
      out_trade_no: 'SO-1',
      transaction_id: 'TX-1',
      amount: { total: 100 }
    }))).toThrow(new BadRequestException('Wechat callback payload missing trade_state'));

    expect(() => verification.extractWechatCallbackPayloadForBusinessMapping(encryptedCallback({
      appid: 'wx-app',
      out_trade_no: 'SO-1',
      transaction_id: 'TX-1',
      trade_state: 'SUCCESS',
      amount: { total: 100 }
    }))).toThrow(new BadRequestException('Wechat callback missing mchid'));
  });

  test('native callback rejects wrong event type, appid mismatch, and invalid payment mode', () => {
    process.env.WECHAT_PAY_API_V3_KEY = TEST_API_V3_KEY;
    process.env.WECHAT_PAY_MODE = 'direct';
    process.env.WECHAT_MINIAPP_APP_ID = 'wx-app';
    process.env.WECHAT_PAY_MERCHANT_ID = 'merchant-1';
    const verification = new MiniappPaymentCallbackVerificationService();
    const payload = {
      appid: 'wx-app',
      mchid: 'merchant-1',
      out_trade_no: 'SO-2',
      transaction_id: 'TX-2',
      trade_state: 'SUCCESS',
      amount: { total: 100 }
    };

    const wrongEvent = encryptedCallback(payload);
    wrongEvent.event_type = 'REFUND.SUCCESS';
    expect(() =>
      verification.extractWechatCallbackPayloadForBusinessMapping(wrongEvent)
    ).toThrow(new BadRequestException('Wechat callback event_type is not TRANSACTION.SUCCESS'));

    expect(() =>
      verification.extractWechatCallbackPayloadForBusinessMapping(encryptedCallback({
        ...payload,
        appid: 'wx-other'
      }))
    ).toThrow(new BadRequestException('Wechat callback appid mismatch'));

    process.env.WECHAT_PAY_MODE = 'unexpected';
    expect(() =>
      verification.extractWechatCallbackPayloadForBusinessMapping(encryptedCallback(payload))
    ).toThrow(new InternalServerErrorException('WECHAT_PAY_MODE must be "direct" or "partner"'));
  });
});
