import { InternalServerErrorException } from '@nestjs/common';
import { generateKeyPairSync } from 'crypto';
import { WechatMiniappPaymentCreateClient } from '../src/modules/orders/wechat-miniapp-payment-create.client';

describe('WechatMiniappPaymentCreateClient', () => {
  const originalPaymentMode = process.env.WECHAT_PAY_MODE;
  const originalAppId = process.env.WECHAT_MINIAPP_APP_ID;
  const originalMerchantId = process.env.WECHAT_PAY_MERCHANT_ID;
  const originalMerchantSerial = process.env.WECHAT_PAY_MERCHANT_SERIAL;
  const originalMerchantPrivateKeyPem = process.env.WECHAT_PAY_MERCHANT_PRIVATE_KEY_PEM;
  const originalSpMerchantId = process.env.WECHAT_PAY_SP_MERCHANT_ID;
  const originalSubMerchantId = process.env.WECHAT_PAY_SUB_MERCHANT_ID;
  const originalSpMerchantSerial = process.env.WECHAT_PAY_SP_MERCHANT_SERIAL;
  const originalSpMerchantPrivateKeyPem = process.env.WECHAT_PAY_SP_MERCHANT_PRIVATE_KEY_PEM;
  const originalNotifyUrl = process.env.WECHAT_PAY_NOTIFY_URL;
  const originalFetch = global.fetch;

  afterEach(() => {
    if (originalPaymentMode === undefined) {
      delete process.env.WECHAT_PAY_MODE;
    } else {
      process.env.WECHAT_PAY_MODE = originalPaymentMode;
    }

    if (originalAppId === undefined) {
      delete process.env.WECHAT_MINIAPP_APP_ID;
    } else {
      process.env.WECHAT_MINIAPP_APP_ID = originalAppId;
    }

    if (originalMerchantId === undefined) {
      delete process.env.WECHAT_PAY_MERCHANT_ID;
    } else {
      process.env.WECHAT_PAY_MERCHANT_ID = originalMerchantId;
    }

    if (originalMerchantSerial === undefined) {
      delete process.env.WECHAT_PAY_MERCHANT_SERIAL;
    } else {
      process.env.WECHAT_PAY_MERCHANT_SERIAL = originalMerchantSerial;
    }

    if (originalMerchantPrivateKeyPem === undefined) {
      delete process.env.WECHAT_PAY_MERCHANT_PRIVATE_KEY_PEM;
    } else {
      process.env.WECHAT_PAY_MERCHANT_PRIVATE_KEY_PEM = originalMerchantPrivateKeyPem;
    }

    if (originalSpMerchantId === undefined) {
      delete process.env.WECHAT_PAY_SP_MERCHANT_ID;
    } else {
      process.env.WECHAT_PAY_SP_MERCHANT_ID = originalSpMerchantId;
    }

    if (originalSubMerchantId === undefined) {
      delete process.env.WECHAT_PAY_SUB_MERCHANT_ID;
    } else {
      process.env.WECHAT_PAY_SUB_MERCHANT_ID = originalSubMerchantId;
    }

    if (originalSpMerchantSerial === undefined) {
      delete process.env.WECHAT_PAY_SP_MERCHANT_SERIAL;
    } else {
      process.env.WECHAT_PAY_SP_MERCHANT_SERIAL = originalSpMerchantSerial;
    }

    if (originalSpMerchantPrivateKeyPem === undefined) {
      delete process.env.WECHAT_PAY_SP_MERCHANT_PRIVATE_KEY_PEM;
    } else {
      process.env.WECHAT_PAY_SP_MERCHANT_PRIVATE_KEY_PEM = originalSpMerchantPrivateKeyPem;
    }

    if (originalNotifyUrl === undefined) {
      delete process.env.WECHAT_PAY_NOTIFY_URL;
    } else {
      process.env.WECHAT_PAY_NOTIFY_URL = originalNotifyUrl;
    }

    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('createMiniappPayment calls wechat pay and returns requestPayment-compatible launch params', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

    delete process.env.WECHAT_PAY_MODE;
    process.env.WECHAT_MINIAPP_APP_ID = 'wx-miniapp-app-id-1';
    process.env.WECHAT_PAY_MERCHANT_ID = 'merchant-1';
    process.env.WECHAT_PAY_MERCHANT_SERIAL = 'merchant-serial-1';
    process.env.WECHAT_PAY_MERCHANT_PRIVATE_KEY_PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    process.env.WECHAT_PAY_NOTIFY_URL = 'https://example.com/orders/miniapp-payment-callback';

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ prepay_id: 'wx-prepay-1' })
    });
    global.fetch = fetchMock as any;

    const client = new WechatMiniappPaymentCreateClient();
    const result = await client.createMiniappPayment({
      orderNo: 'SO-PAY-1',
      totalAmountCents: 12800,
      openId: 'openid-pay-1'
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: expect.stringContaining('WECHATPAY2-SHA256-RSA2048')
        }),
        body: JSON.stringify({
          appid: 'wx-miniapp-app-id-1',
          mchid: 'merchant-1',
          description: 'SO-PAY-1',
          out_trade_no: 'SO-PAY-1',
          notify_url: 'https://example.com/orders/miniapp-payment-callback',
          amount: {
            total: 12800,
            currency: 'CNY'
          },
          payer: {
            openid: 'openid-pay-1'
          }
        })
      })
    );
    expect(result).toEqual({
      launchParams: {
        timeStamp: expect.stringMatching(/^\d+$/),
        nonceStr: expect.stringMatching(/^[0-9a-f]+$/),
        package: 'prepay_id=wx-prepay-1',
        signType: 'RSA',
        paySign: expect.any(String)
      }
    });
  });

  test('createMiniappPayment uses partner jsapi with sub-appid and sub-openid in partner mode', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

    process.env.WECHAT_PAY_MODE = 'partner';
    process.env.WECHAT_MINIAPP_APP_ID = 'wx-sub-miniapp-app-id-1';
    process.env.WECHAT_PAY_SP_MERCHANT_ID = 'sp-merchant-1';
    process.env.WECHAT_PAY_SUB_MERCHANT_ID = 'sub-merchant-1';
    process.env.WECHAT_PAY_SP_MERCHANT_SERIAL = 'sp-merchant-serial-1';
    process.env.WECHAT_PAY_SP_MERCHANT_PRIVATE_KEY_PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    process.env.WECHAT_PAY_NOTIFY_URL = 'https://example.com/orders/miniapp-payment-callback';

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ prepay_id: 'wx-prepay-partner-1' })
    });
    global.fetch = fetchMock as any;

    const client = new WechatMiniappPaymentCreateClient();
    const result = await client.createMiniappPayment({
      orderNo: 'SO-PAY-PARTNER-1',
      totalAmountCents: 25600,
      openId: 'openid-sub-1'
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.mch.weixin.qq.com/v3/pay/partner/transactions/jsapi',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: expect.stringContaining('mchid="sp-merchant-1"')
        }),
        body: JSON.stringify({
          sp_mchid: 'sp-merchant-1',
          sub_mchid: 'sub-merchant-1',
          sub_appid: 'wx-sub-miniapp-app-id-1',
          description: 'SO-PAY-PARTNER-1',
          out_trade_no: 'SO-PAY-PARTNER-1',
          notify_url: 'https://example.com/orders/miniapp-payment-callback',
          amount: {
            total: 25600,
            currency: 'CNY'
          },
          payer: {
            sub_openid: 'openid-sub-1'
          }
        })
      })
    );
    expect(result).toEqual({
      launchParams: {
        timeStamp: expect.stringMatching(/^\d+$/),
        nonceStr: expect.stringMatching(/^[0-9a-f]+$/),
        package: 'prepay_id=wx-prepay-partner-1',
        signType: 'RSA',
        paySign: expect.any(String)
      }
    });
  });

  test('createMiniappPayment fails honestly when merchant payment config is missing', async () => {
    delete process.env.WECHAT_PAY_MODE;
    process.env.WECHAT_MINIAPP_APP_ID = 'wx-miniapp-app-id-1';
    delete process.env.WECHAT_PAY_MERCHANT_ID;
    process.env.WECHAT_PAY_MERCHANT_SERIAL = 'merchant-serial-1';
    process.env.WECHAT_PAY_MERCHANT_PRIVATE_KEY_PEM = 'invalid';
    process.env.WECHAT_PAY_NOTIFY_URL = 'https://example.com/orders/miniapp-payment-callback';

    const client = new WechatMiniappPaymentCreateClient();

    await expect(
      client.createMiniappPayment({
        orderNo: 'SO-PAY-2',
        totalAmountCents: 6400,
        openId: 'openid-pay-2'
      })
    ).rejects.toThrow(new InternalServerErrorException('WECHAT_PAY_MERCHANT_ID is not configured'));
  });

  test('createMiniappPayment surfaces upstream status, code, and message for partner validation', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

    process.env.WECHAT_PAY_MODE = 'partner';
    process.env.WECHAT_MINIAPP_APP_ID = 'wx-sub-miniapp-app-id-1';
    process.env.WECHAT_PAY_SP_MERCHANT_ID = 'sp-merchant-1';
    process.env.WECHAT_PAY_SUB_MERCHANT_ID = 'sub-merchant-1';
    process.env.WECHAT_PAY_SP_MERCHANT_SERIAL = 'sp-merchant-serial-1';
    process.env.WECHAT_PAY_SP_MERCHANT_PRIVATE_KEY_PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    process.env.WECHAT_PAY_NOTIFY_URL = 'https://example.com/orders/miniapp-payment-callback';

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({
        code: 'NO_AUTH',
        message: '商户号该产品权限未开通，请前往商户平台>产品中心检查后重试'
      })
    }) as any;

    const client = new WechatMiniappPaymentCreateClient();

    await expect(
      client.createMiniappPayment({
        orderNo: 'SO-PAY-PARTNER-ERR-1',
        totalAmountCents: 3200,
        openId: 'openid-sub-err-1'
      })
    ).rejects.toThrow(
      'Wechat miniapp payment create failed with upstream status 403; code=NO_AUTH; message=商户号该产品权限未开通，请前往商户平台>产品中心检查后重试'
    );
  });
});
