import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { UserRole } from '../src/common/roles/role.enum';
import { CustomerAuthArtifactGuard } from '../src/modules/auth-exchange/customer-auth-artifact.guard';
import { CustomerAuthArtifactService } from '../src/modules/auth-exchange/customer-auth-artifact.service';
import { OrdersController } from '../src/modules/orders/orders.controller';

const SAMPLE_CREATE_ORDER_DTO = {
  storeId: 'store-1',
  fulfillmentType: 'STORE_PICKUP',
  items: [{ skuId: 'sku-1', quantity: 1 }],
  pickupDate: '2026-04-08T10:00:00.000Z',
  pickupTimeSlot: '10:00-12:00'
};

describe('OrdersController header forwarding', () => {
  const originalSecret = process.env.CUSTOMER_AUTH_ARTIFACT_SECRET;
  const adminRequest = {
    headers: {},
    admin: {
      adminId: 'admin-1',
      username: 'admin',
      displayName: '管理员',
      role: AdminRole.ADMIN,
      storeId: null
    }
  };

  beforeEach(() => {
    process.env.CUSTOMER_AUTH_ARTIFACT_SECRET = 'test-customer-auth-secret';
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.CUSTOMER_AUTH_ARTIFACT_SECRET;
      return;
    }

    process.env.CUSTOMER_AUTH_ARTIFACT_SECRET = originalSecret;
  });

  test('previewOrderQuote forwards body to workflow service', async () => {
    const workflow = {
      previewOrderQuote: jest.fn().mockResolvedValue({})
    } as any;

    const controller = new OrdersController(workflow);
    const payload = {
      storeId: 'store-1',
      fulfillmentType: 'SHIPPING',
      items: [{ skuId: 'sku-1', quantity: 1 }],
      couponCode: 'WELCOME-1000'
    };

    await controller.previewOrderQuote(payload as any);

    expect(workflow.previewOrderQuote).toHaveBeenCalledWith(payload);
  });

  test('handleMiniappPaymentCallback returns provider-safe acknowledgment for applied verified completion', async () => {
    const workflow = {
      handleMiniappPaymentCallback: jest.fn().mockResolvedValue(
        {
          stage: 'CALLBACK_COMPLETION',
          provider: 'wechat',
          status: 'APPLIED',
          orderId: 'o-callback-1',
          orderNo: 'SO-20260408-1',
          paymentRef: 'wx-tx-1001',
          paidAmountCents: 12800,
          message: 'Verified callback payment applied'
        }
      )
    } as any;

    const controller = new OrdersController(workflow);
    const payload = {
      provider: 'wechat',
      callbackPayload: {
        transactionId: 'tx-1'
      },
      raw: {
        debugSource: 'provider-callback'
      }
    };
    const request = {
      rawBody: Buffer.from('{"transactionId":"tx-1"}', 'utf8')
    };

    const result = await controller.handleMiniappPaymentCallback(
      payload as any,
      '1712563200',
      'nonce-1',
      'serial-1',
      'signature-1',
      request as any
    );

    expect(workflow.handleMiniappPaymentCallback).toHaveBeenCalledWith(payload, {
      rawBody: '{"transactionId":"tx-1"}',
      wechatpayTimestamp: '1712563200',
      wechatpayNonce: 'nonce-1',
      wechatpaySerial: 'serial-1',
      wechatpaySignature: 'signature-1'
    });
    expect(result).toEqual({ acknowledged: true });
  });

  test('handleMiniappPaymentCallback returns provider-safe acknowledgment for verified same-order duplicate', async () => {
    const workflow = {
      handleMiniappPaymentCallback: jest.fn().mockResolvedValue({
        stage: 'CALLBACK_COMPLETION',
        provider: 'wechat',
        status: 'IGNORED_DUPLICATE',
        orderId: 'o-callback-2',
        orderNo: 'SO-20260408-2',
        paymentRef: 'wx-tx-1002',
        paidAmountCents: 6400,
        message: 'Verified callback duplicate acknowledged'
      })
    } as any;

    const controller = new OrdersController(workflow);

    await expect(
      controller.handleMiniappPaymentCallback(
        {
          provider: 'wechat',
          callbackPayload: { transactionId: 'tx-2' }
        } as any,
        '1712563201',
        'nonce-2',
        'serial-2',
        'signature-2',
        {
          rawBody: Buffer.from('{"transactionId":"tx-2"}', 'utf8')
        } as any
      )
    ).resolves.toEqual({ acknowledged: true });
  });

  test('handleMiniappPaymentCallback accepts native Wechat body without provider wrapper', async () => {
    const workflow = {
      handleMiniappPaymentCallback: jest.fn().mockResolvedValue({
        stage: 'CALLBACK_COMPLETION',
        provider: 'wechat',
        status: 'APPLIED',
        orderId: 'o-native-1',
        orderNo: 'SO-NATIVE-1',
        paymentRef: 'wx-native-1',
        paidAmountCents: 5900,
        message: 'Verified callback payment applied'
      })
    } as any;
    const controller = new OrdersController(workflow);
    const rawBody = JSON.stringify({
      id: 'callback-id-1',
      event_type: 'TRANSACTION.SUCCESS',
      resource: {
        algorithm: 'AEAD_AES_256_GCM',
        ciphertext: 'ciphertext-not-logged',
        associated_data: 'transaction',
        nonce: 'nonce-1'
      }
    });

    await expect(
      controller.handleMiniappPaymentCallback(
        {} as any,
        '1712563203',
        'nonce-native',
        'serial-native',
        'signature-native',
        {
          rawBody: Buffer.from(rawBody, 'utf8')
        } as any
      )
    ).resolves.toEqual({ acknowledged: true });

    expect(workflow.handleMiniappPaymentCallback).toHaveBeenCalledWith({
      provider: 'wechat',
      callbackPayload: JSON.parse(rawBody)
    }, {
      rawBody,
      wechatpayTimestamp: '1712563203',
      wechatpayNonce: 'nonce-native',
      wechatpaySerial: 'serial-native',
      wechatpaySignature: 'signature-native'
    });
  });

  test('handleMiniappPaymentCallback preserves existing failure flow', async () => {
    const workflow = {
      handleMiniappPaymentCallback: jest.fn().mockRejectedValue(new BadRequestException('Duplicate paymentRef used for a different order'))
    } as any;

    const controller = new OrdersController(workflow);

    await expect(
      controller.handleMiniappPaymentCallback(
        {
          provider: 'wechat',
          callbackPayload: { transactionId: 'tx-conflict' }
        } as any,
        '1712563202',
        'nonce-3',
        'serial-3',
        'signature-3',
        {
          rawBody: Buffer.from('{"transactionId":"tx-conflict"}', 'utf8')
        } as any
      )
    ).rejects.toThrow(new BadRequestException('Duplicate paymentRef used for a different order'));
  });

  test('shared createOrder forwards legacy customer scope to workflow service', async () => {
    const workflow = {
      createOrder: jest.fn().mockResolvedValue({
        id: 'order-legacy-create',
        orderNo: 'SO-LEGACY-1'
      })
    } as any;

    const controller = new OrdersController(workflow);
    const result = await controller.createOrder('legacy-customer', SAMPLE_CREATE_ORDER_DTO as any);

    expect(workflow.createOrder).toHaveBeenCalledWith('legacy-customer', SAMPLE_CREATE_ORDER_DTO);
    expect(result).toEqual({
      id: 'order-legacy-create',
      orderNo: 'SO-LEGACY-1'
    });
  });

  test('authenticated createOrder forwards backend-verified customer scope to workflow service', async () => {
    const workflow = {
      createOrder: jest.fn().mockResolvedValue({
        id: 'order-auth-create',
        orderNo: 'SO-AUTH-CREATE-1'
      })
    } as any;
    const controller = new OrdersController(workflow);
    const service = new CustomerAuthArtifactService();
    const guard = new CustomerAuthArtifactGuard(service);
    const artifact = service.issue({
      provider: 'wechat',
      userId: 'wechat:customer-create-1',
      role: UserRole.CUSTOMER
    });
    const request = {
      headers: {
        authorization: `Bearer ${artifact}`
      }
    } as any;
    const context = {
      switchToHttp: () => ({
        getRequest: () => request
      })
    } as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);

    const result = await controller.createAuthenticatedOrder(request, SAMPLE_CREATE_ORDER_DTO as any);

    expect(workflow.createOrder).toHaveBeenCalledWith('wechat:customer-create-1', SAMPLE_CREATE_ORDER_DTO);
    expect(result).toEqual({
      id: 'order-auth-create',
      orderNo: 'SO-AUTH-CREATE-1'
    });
  });

  test('authenticated order create seam fails honestly when auth artifact is missing', () => {
    const guard = new CustomerAuthArtifactGuard(new CustomerAuthArtifactService());
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {}
        })
      })
    } as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(new UnauthorizedException('Missing Bearer customer auth artifact'));
  });

  test('authenticated order create seam fails honestly when auth artifact is invalid', () => {
    const service = new CustomerAuthArtifactService();
    const guard = new CustomerAuthArtifactGuard(service);
    const artifact = service.issue({
      provider: 'wechat',
      userId: 'wechat:customer-create-1',
      role: UserRole.CUSTOMER
    });
    const tamperedArtifact = `${artifact.slice(0, -1)}x`;
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            authorization: `Bearer ${tamperedArtifact}`
          }
        })
      })
    } as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(new UnauthorizedException('Invalid customer auth artifact signature'));
  });

  test('listOrders forwards admin actor scope to workflow service', async () => {
    const workflow = {
      listOrders: jest.fn().mockResolvedValue([])
    } as any;

    const controller = new OrdersController(workflow);
    await controller.listOrders(adminRequest);

    expect(workflow.listOrders).toHaveBeenCalledWith({
      role: AdminRole.ADMIN,
      adminId: 'admin-1',
      storeId: null
    });
  });

  test('authenticated listOrders forwards backend-verified customer scope to workflow service', async () => {
    const workflow = {
      listOrders: jest.fn().mockResolvedValue([
        {
          id: 'order-auth-1',
          orderNo: 'SO-AUTH-1'
        }
      ])
    } as any;
    const controller = new OrdersController(workflow);
    const service = new CustomerAuthArtifactService();
    const guard = new CustomerAuthArtifactGuard(service);
    const artifact = service.issue({
      provider: 'wechat',
      userId: 'wechat:customer-1',
      role: UserRole.CUSTOMER
    });
    const request = {
      headers: {
        authorization: `Bearer ${artifact}`
      }
    } as any;
    const context = {
      switchToHttp: () => ({
        getRequest: () => request
      })
    } as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);

    const result = await controller.listAuthenticatedOrders(request);

    expect(workflow.listOrders).toHaveBeenCalledWith({
      role: UserRole.CUSTOMER,
      userId: 'wechat:customer-1'
    });
    expect(result).toEqual([
      {
        id: 'order-auth-1',
        orderNo: 'SO-AUTH-1'
      }
    ]);
  });

  test('authenticated order read seam fails honestly when auth artifact is missing', () => {
    const guard = new CustomerAuthArtifactGuard(new CustomerAuthArtifactService());
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {}
        })
      })
    } as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(new UnauthorizedException('Missing Bearer customer auth artifact'));
  });

  test('authenticated order read seam fails honestly when auth artifact is invalid', () => {
    const service = new CustomerAuthArtifactService();
    const guard = new CustomerAuthArtifactGuard(service);
    const artifact = service.issue({
      provider: 'wechat',
      userId: 'wechat:customer-1',
      role: UserRole.CUSTOMER
    });
    const tamperedArtifact = `${artifact.slice(0, -1)}x`;
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            authorization: `Bearer ${tamperedArtifact}`
          }
        })
      })
    } as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(new UnauthorizedException('Invalid customer auth artifact signature'));
  });

  test('getOrder forwards admin actor scope to workflow service', async () => {
    const workflow = {
      getOrder: jest.fn().mockResolvedValue({})
    } as any;

    const controller = new OrdersController(workflow);
    await controller.getOrder('order-1', adminRequest);

    expect(workflow.getOrder).toHaveBeenCalledWith('order-1', {
      role: AdminRole.ADMIN,
      adminId: 'admin-1',
      storeId: null
    });
  });

  test('authenticated getOrder forwards backend-verified customer scope to workflow service', async () => {
    const workflow = {
      getOrder: jest.fn().mockResolvedValue({
        id: 'order-auth-detail-1',
        orderNo: 'SO-AUTH-DETAIL-1'
      })
    } as any;
    const controller = new OrdersController(workflow);
    const service = new CustomerAuthArtifactService();
    const guard = new CustomerAuthArtifactGuard(service);
    const artifact = service.issue({
      provider: 'wechat',
      userId: 'wechat:customer-detail-1',
      role: UserRole.CUSTOMER
    });
    const request = {
      headers: {
        authorization: `Bearer ${artifact}`
      }
    } as any;
    const context = {
      switchToHttp: () => ({
        getRequest: () => request
      })
    } as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);

    const result = await controller.getAuthenticatedOrder('order-auth-detail-1', request);

    expect(workflow.getOrder).toHaveBeenCalledWith('order-auth-detail-1', {
      role: UserRole.CUSTOMER,
      userId: 'wechat:customer-detail-1'
    });
    expect(result).toEqual({
      id: 'order-auth-detail-1',
      orderNo: 'SO-AUTH-DETAIL-1'
    });
  });

  test('authenticated createMiniappPayment forwards backend-verified customer scope to workflow service', async () => {
    const workflow = {
      createMiniappPayment: jest.fn().mockResolvedValue({
        provider: 'wechat',
        initiationType: 'MINIAPP',
        orderId: 'order-auth-pay-1',
        orderNo: 'SO-AUTH-PAY-1',
        totalAmountCents: 12800,
        launchParams: {
          timeStamp: '1712563200',
          nonceStr: 'nonce-pay-1',
          package: 'prepay_id=wx-prepay-1',
          signType: 'RSA',
          paySign: 'signature-pay-1'
        }
      })
    } as any;
    const controller = new OrdersController(workflow);
    const service = new CustomerAuthArtifactService();
    const guard = new CustomerAuthArtifactGuard(service);
    const artifact = service.issue({
      provider: 'wechat',
      userId: 'wechat:customer-pay-1',
      role: UserRole.CUSTOMER
    });
    const request = {
      headers: {
        authorization: `Bearer ${artifact}`
      }
    } as any;
    const context = {
      switchToHttp: () => ({
        getRequest: () => request
      })
    } as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);

    const result = await controller.createMiniappPayment('order-auth-pay-1', request);

    expect(workflow.createMiniappPayment).toHaveBeenCalledWith('order-auth-pay-1', {
      role: UserRole.CUSTOMER,
      userId: 'wechat:customer-pay-1'
    });
    expect(result).toEqual({
      provider: 'wechat',
      initiationType: 'MINIAPP',
      orderId: 'order-auth-pay-1',
      orderNo: 'SO-AUTH-PAY-1',
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

  test('markPaid forwards admin actor scope to workflow service', async () => {
    const workflow = {
      markPaid: jest.fn().mockResolvedValue({ result: 'APPLIED' })
    } as any;

    const controller = new OrdersController(workflow);
    await controller.markPaid('order-1', { paymentRef: 'pay-1', paidAmountCents: 1000 }, adminRequest);

    expect(workflow.markPaid).toHaveBeenCalledWith('order-1', 'pay-1', 1000, {
      role: AdminRole.ADMIN,
      adminId: 'admin-1',
      storeId: null
    });
  });

  test('cancel forwards admin actor scope to workflow service', async () => {
    const workflow = {
      cancelOrder: jest.fn().mockResolvedValue({ result: 'CANCELLED' })
    } as any;

    const controller = new OrdersController(workflow);
    await controller.cancel('order-1', {}, adminRequest);

    expect(workflow.cancelOrder).toHaveBeenCalledWith(
      'order-1',
      {
        role: AdminRole.ADMIN,
        adminId: 'admin-1',
        storeId: null
      },
      undefined
    );
  });
});
