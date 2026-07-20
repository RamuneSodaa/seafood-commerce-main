import { UnauthorizedException } from '@nestjs/common';
import { createSign, generateKeyPairSync } from 'crypto';
import { MiniappPaymentCallbackVerificationService } from '../src/modules/orders/miniapp-payment-callback-verification.service';
import { WechatMiniappPaymentCreateClient } from '../src/modules/orders/wechat-miniapp-payment-create.client';

function signWechatMessage(
  privateKey: any,
  timestamp: string,
  nonce: string,
  body: string
): string {
  const signer = createSign('RSA-SHA256');
  signer.update(`${timestamp}\n${nonce}\n${body}\n`);
  signer.end();
  return signer.sign(privateKey, 'base64');
}

function signedResponse(
  body: string,
  privateKey: any,
  publicKeyId: string,
  signedBody = body
) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = 'wechat-response-nonce';
  const signature = signWechatMessage(privateKey, timestamp, nonce, signedBody);
  const headers = new Map<string, string>([
    ['wechatpay-timestamp', timestamp],
    ['wechatpay-nonce', nonce],
    ['wechatpay-serial', publicKeyId],
    ['wechatpay-signature', signature]
  ]);

  return {
    ok: true,
    status: 200,
    headers: {
      get(name: string) {
        return headers.get(name.toLowerCase()) ?? null;
      }
    },
    text: async () => body
  };
}

describe('Wechat Pay public-key security', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('accepts callback signed by configured WeChat Pay public key ID', () => {
    const { privateKey, publicKey } =
      generateKeyPairSync('rsa', { modulusLength: 2048 });
    const publicKeyId = 'PUB_KEY_ID_TEST_CALLBACK';

    process.env.WECHAT_PAY_PUBLIC_KEY_PEM =
      publicKey.export({ type: 'spki', format: 'pem' }).toString();
    process.env.WECHAT_PAY_PUBLIC_KEY_ID = publicKeyId;
    delete process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM;
    delete process.env.WECHAT_PAY_PLATFORM_SERIAL;

    const rawBody =
      '{"merchantOrderNo":"SO-PUBLIC-KEY-1","transactionId":"wx-public-key-1","paidAmountCents":100}';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = 'callback-nonce';

    const service = new MiniappPaymentCallbackVerificationService();

    expect(
      service.verifyWechatCallbackSignature(JSON.parse(rawBody), {
        rawBody,
        wechatpayTimestamp: timestamp,
        wechatpayNonce: nonce,
        wechatpaySerial: publicKeyId,
        wechatpaySignature: signWechatMessage(
          privateKey,
          timestamp,
          nonce,
          rawBody
        )
      })
    ).toEqual({
      provider: 'wechat',
      callbackPayload: JSON.parse(rawBody)
    });
  });

  test('rejects replay-like callback timestamp outside five-minute window', () => {
    const { privateKey, publicKey } =
      generateKeyPairSync('rsa', { modulusLength: 2048 });
    const publicKeyId = 'PUB_KEY_ID_TEST_REPLAY';

    process.env.WECHAT_PAY_PUBLIC_KEY_PEM =
      publicKey.export({ type: 'spki', format: 'pem' }).toString();
    process.env.WECHAT_PAY_PUBLIC_KEY_ID = publicKeyId;
    delete process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM;
    delete process.env.WECHAT_PAY_PLATFORM_SERIAL;

    const rawBody = '{"id":"replay-test"}';
    const timestamp = (Math.floor(Date.now() / 1000) - 301).toString();
    const nonce = 'stale-nonce';
    const service = new MiniappPaymentCallbackVerificationService();

    expect(() =>
      service.verifyWechatCallbackSignature(JSON.parse(rawBody), {
        rawBody,
        wechatpayTimestamp: timestamp,
        wechatpayNonce: nonce,
        wechatpaySerial: publicKeyId,
        wechatpaySignature: signWechatMessage(
          privateKey,
          timestamp,
          nonce,
          rawBody
        )
      })
    ).toThrow(
      new UnauthorizedException(
        'Wechat callback signature timestamp is outside allowed window'
      )
    );
  });

  test('rejects callback signed under a different WeChat Pay public key ID', () => {
    const { privateKey, publicKey } =
      generateKeyPairSync('rsa', { modulusLength: 2048 });

    process.env.WECHAT_PAY_PUBLIC_KEY_PEM =
      publicKey.export({ type: 'spki', format: 'pem' }).toString();
    process.env.WECHAT_PAY_PUBLIC_KEY_ID = 'PUB_KEY_ID_EXPECTED';
    delete process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM;
    delete process.env.WECHAT_PAY_PLATFORM_SERIAL;

    const rawBody = '{"id":"wrong-key-id"}';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = 'wrong-key-id-nonce';
    const service = new MiniappPaymentCallbackVerificationService();

    expect(() =>
      service.verifyWechatCallbackSignature(JSON.parse(rawBody), {
        rawBody,
        wechatpayTimestamp: timestamp,
        wechatpayNonce: nonce,
        wechatpaySerial: 'PUB_KEY_ID_OTHER',
        wechatpaySignature: signWechatMessage(
          privateKey,
          timestamp,
          nonce,
          rawBody
        )
      })
    ).toThrow(
      new UnauthorizedException('Wechat callback key id mismatch')
    );
  });

  test('verifies signed JSAPI prepay response before returning launch params', async () => {
    const merchantKeys =
      generateKeyPairSync('rsa', { modulusLength: 2048 });
    const wechatKeys =
      generateKeyPairSync('rsa', { modulusLength: 2048 });
    const publicKeyId = 'PUB_KEY_ID_TEST_RESPONSE';

    process.env.WECHAT_PAY_MODE = 'direct';
    process.env.WECHAT_MINIAPP_APP_ID = 'wx-test-appid';
    process.env.WECHAT_PAY_MERCHANT_ID = 'merchant-test';
    process.env.WECHAT_PAY_MERCHANT_SERIAL = 'merchant-serial-test';
    process.env.WECHAT_PAY_MERCHANT_PRIVATE_KEY_PEM =
      merchantKeys.privateKey
        .export({ type: 'pkcs8', format: 'pem' })
        .toString();
    process.env.WECHAT_PAY_NOTIFY_URL =
      'https://example.com/orders/miniapp-payment-callback';
    process.env.WECHAT_PAY_PUBLIC_KEY_PEM =
      wechatKeys.publicKey
        .export({ type: 'spki', format: 'pem' })
        .toString();
    process.env.WECHAT_PAY_PUBLIC_KEY_ID = publicKeyId;

    const body = JSON.stringify({
      prepay_id: 'wx-secure-prepay-1'
    });

    global.fetch = jest.fn().mockResolvedValue(
      signedResponse(body, wechatKeys.privateKey, publicKeyId)
    ) as any;

    const result =
      await new WechatMiniappPaymentCreateClient()
        .createMiniappPayment({
          orderNo: 'SO-SECURE-PAY-1',
          totalAmountCents: 1,
          openId: 'openid-secure-1'
        });

    expect(result.launchParams.package)
      .toBe('prepay_id=wx-secure-prepay-1');
  });

  test('rejects tampered JSAPI prepay response body', async () => {
    const merchantKeys =
      generateKeyPairSync('rsa', { modulusLength: 2048 });
    const wechatKeys =
      generateKeyPairSync('rsa', { modulusLength: 2048 });
    const publicKeyId = 'PUB_KEY_ID_TEST_TAMPER';

    process.env.WECHAT_PAY_MODE = 'direct';
    process.env.WECHAT_MINIAPP_APP_ID = 'wx-test-appid';
    process.env.WECHAT_PAY_MERCHANT_ID = 'merchant-test';
    process.env.WECHAT_PAY_MERCHANT_SERIAL = 'merchant-serial-test';
    process.env.WECHAT_PAY_MERCHANT_PRIVATE_KEY_PEM =
      merchantKeys.privateKey
        .export({ type: 'pkcs8', format: 'pem' })
        .toString();
    process.env.WECHAT_PAY_NOTIFY_URL =
      'https://example.com/orders/miniapp-payment-callback';
    process.env.WECHAT_PAY_PUBLIC_KEY_PEM =
      wechatKeys.publicKey
        .export({ type: 'spki', format: 'pem' })
        .toString();
    process.env.WECHAT_PAY_PUBLIC_KEY_ID = publicKeyId;

    const actualBody = JSON.stringify({
      prepay_id: 'wx-tampered-prepay'
    });
    const signedDifferentBody = JSON.stringify({
      prepay_id: 'wx-original-prepay'
    });

    global.fetch = jest.fn().mockResolvedValue(
      signedResponse(
        actualBody,
        wechatKeys.privateKey,
        publicKeyId,
        signedDifferentBody
      )
    ) as any;

    await expect(
      new WechatMiniappPaymentCreateClient()
        .createMiniappPayment({
          orderNo: 'SO-TAMPER-PAY-1',
          totalAmountCents: 1,
          openId: 'openid-secure-1'
        })
    ).rejects.toThrow(
      new UnauthorizedException(
        'Wechat response signature verification failed'
      )
    );
  });
});
