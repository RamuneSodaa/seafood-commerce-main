import { BadGatewayException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { createSign, randomBytes } from 'crypto';

type WechatMiniappPaymentCreateResponse = {
  prepay_id?: string;
  code?: string;
  message?: string;
};

export type WechatMiniappLaunchParams = {
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: 'RSA';
  paySign: string;
};

type WechatPaymentMode = 'direct' | 'partner';

function readRequiredWechatPaymentConfig(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new InternalServerErrorException(`${name} is not configured`);
  }

  return value;
}

function readWechatPaymentMode(): WechatPaymentMode {
  const rawMode = process.env.WECHAT_PAY_MODE?.trim().toLowerCase();

  if (!rawMode || rawMode === 'direct') {
    return 'direct';
  }

  if (rawMode === 'partner') {
    return 'partner';
  }

  throw new InternalServerErrorException('WECHAT_PAY_MODE must be "direct" or "partner"');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function signWechatMessage(message: string, privateKeyPem: string): string {
  try {
    const signer = createSign('RSA-SHA256');
    signer.update(message);
    signer.end();
    return signer.sign(privateKeyPem, 'base64');
  } catch {
    throw new InternalServerErrorException('WECHAT_PAY_MERCHANT_PRIVATE_KEY_PEM is invalid');
  }
}

function buildWechatPayAuthorization(input: {
  merchantId: string;
  merchantSerial: string;
  privateKeyPem: string;
  method: 'POST';
  pathname: string;
  body: string;
}): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = randomBytes(16).toString('hex');
  const message = `${input.method}\n${input.pathname}\n${timestamp}\n${nonceStr}\n${input.body}\n`;
  const signature = signWechatMessage(message, input.privateKeyPem);

  return `WECHATPAY2-SHA256-RSA2048 mchid="${input.merchantId}",nonce_str="${nonceStr}",signature="${signature}",timestamp="${timestamp}",serial_no="${input.merchantSerial}"`;
}

@Injectable()
export class WechatMiniappPaymentCreateClient {
  async createMiniappPayment(input: {
    orderNo: string;
    totalAmountCents: number;
    openId: string;
  }): Promise<{ launchParams: WechatMiniappLaunchParams }> {
    const paymentMode = readWechatPaymentMode();
    const miniappAppId = readRequiredWechatPaymentConfig('WECHAT_MINIAPP_APP_ID');
    const notifyUrl = readRequiredWechatPaymentConfig('WECHAT_PAY_NOTIFY_URL');
    const requestTarget =
      paymentMode === 'partner'
        ? {
            createUrl: 'https://api.mch.weixin.qq.com/v3/pay/partner/transactions/jsapi',
            createPathname: '/v3/pay/partner/transactions/jsapi',
            authorizationMerchantId: readRequiredWechatPaymentConfig('WECHAT_PAY_SP_MERCHANT_ID'),
            authorizationMerchantSerial: readRequiredWechatPaymentConfig('WECHAT_PAY_SP_MERCHANT_SERIAL'),
            authorizationPrivateKeyPem: readRequiredWechatPaymentConfig('WECHAT_PAY_SP_MERCHANT_PRIVATE_KEY_PEM'),
            requestAppId: miniappAppId,
            requestBody: JSON.stringify({
              sp_mchid: readRequiredWechatPaymentConfig('WECHAT_PAY_SP_MERCHANT_ID'),
              sub_mchid: readRequiredWechatPaymentConfig('WECHAT_PAY_SUB_MERCHANT_ID'),
              sub_appid: miniappAppId,
              description: input.orderNo,
              out_trade_no: input.orderNo,
              notify_url: notifyUrl,
              amount: {
                total: input.totalAmountCents,
                currency: 'CNY'
              },
              payer: {
                sub_openid: input.openId
              }
            })
          }
        : {
            createUrl: 'https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi',
            createPathname: '/v3/pay/transactions/jsapi',
            authorizationMerchantId: readRequiredWechatPaymentConfig('WECHAT_PAY_MERCHANT_ID'),
            authorizationMerchantSerial: readRequiredWechatPaymentConfig('WECHAT_PAY_MERCHANT_SERIAL'),
            authorizationPrivateKeyPem: readRequiredWechatPaymentConfig('WECHAT_PAY_MERCHANT_PRIVATE_KEY_PEM'),
            requestAppId: miniappAppId,
            requestBody: JSON.stringify({
              appid: miniappAppId,
              mchid: readRequiredWechatPaymentConfig('WECHAT_PAY_MERCHANT_ID'),
              description: input.orderNo,
              out_trade_no: input.orderNo,
              notify_url: notifyUrl,
              amount: {
                total: input.totalAmountCents,
                currency: 'CNY'
              },
              payer: {
                openid: input.openId
              }
            })
          };

    const response = await fetch(requestTarget.createUrl, {
      method: 'POST',
      headers: {
        Authorization: buildWechatPayAuthorization({
          merchantId: requestTarget.authorizationMerchantId,
          merchantSerial: requestTarget.authorizationMerchantSerial,
          privateKeyPem: requestTarget.authorizationPrivateKeyPem,
          method: 'POST',
          pathname: requestTarget.createPathname,
          body: requestTarget.requestBody
        }),
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: requestTarget.requestBody
    });

    const responseText = await response.text();

    let payload: unknown = {};
    if (responseText) {
      try {
        payload = JSON.parse(responseText) as WechatMiniappPaymentCreateResponse;
      } catch {
        throw new BadGatewayException('Wechat miniapp payment create returned an invalid payload');
      }
    }

    if (!response.ok) {
      const responseDetails = [] as string[];
      if (isRecord(payload) && typeof payload.code === 'string' && payload.code.trim()) {
        responseDetails.push(`code=${payload.code.trim()}`);
      }
      if (isRecord(payload) && typeof payload.message === 'string' && payload.message.trim()) {
        responseDetails.push(`message=${payload.message.trim()}`);
      } else if (responseText.trim()) {
        responseDetails.push(`body=${responseText.trim()}`);
      }

      const detailSuffix = responseDetails.length > 0 ? `; ${responseDetails.join('; ')}` : '';

      throw new BadGatewayException(`Wechat miniapp payment create failed with upstream status ${response.status}${detailSuffix}`);
    }

    if (!isRecord(payload)) {
      throw new BadGatewayException('Wechat miniapp payment create returned an invalid payload');
    }

    const prepayId = typeof payload.prepay_id === 'string' ? payload.prepay_id.trim() : '';

    if (!prepayId) {
      throw new BadGatewayException('Wechat miniapp payment create did not return prepay_id');
    }

    const launchNonceStr = randomBytes(16).toString('hex');
    const launchTimeStamp = Math.floor(Date.now() / 1000).toString();
    const packageValue = `prepay_id=${prepayId}`;
    const paySign = signWechatMessage(
      `${requestTarget.requestAppId}\n${launchTimeStamp}\n${launchNonceStr}\n${packageValue}\n`,
      requestTarget.authorizationPrivateKeyPem
    );

    return {
      launchParams: {
        timeStamp: launchTimeStamp,
        nonceStr: launchNonceStr,
        package: packageValue,
        signType: 'RSA',
        paySign
      }
    };
  }
}
