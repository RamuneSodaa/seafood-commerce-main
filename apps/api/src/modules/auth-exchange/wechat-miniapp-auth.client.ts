import { BadGatewayException, Injectable, InternalServerErrorException } from '@nestjs/common';

type WechatMiniappCodeExchangeResponse = {
  openid?: string;
  unionid?: string;
  session_key?: string;
  errcode?: number;
  errmsg?: string;
};

function readRequiredWechatConfig(name: 'WECHAT_MINIAPP_APP_ID' | 'WECHAT_MINIAPP_APP_SECRET'): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new InternalServerErrorException(`${name} is not configured`);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

@Injectable()
export class WechatMiniappAuthClient {
  private readonly exchangeUrl = 'https://api.weixin.qq.com/sns/jscode2session';

  async exchangeCode(providerCode: string): Promise<{ openId: string }> {
    const appId = readRequiredWechatConfig('WECHAT_MINIAPP_APP_ID');
    const appSecret = readRequiredWechatConfig('WECHAT_MINIAPP_APP_SECRET');
    const params = new URLSearchParams({
      appid: appId,
      secret: appSecret,
      js_code: providerCode,
      grant_type: 'authorization_code'
    });

    const response = await fetch(`${this.exchangeUrl}?${params.toString()}`);

    if (!response.ok) {
      throw new BadGatewayException(`Wechat miniapp auth exchange request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as WechatMiniappCodeExchangeResponse;

    if (!isRecord(payload)) {
      throw new BadGatewayException('Wechat miniapp auth exchange returned an invalid payload');
    }

    if (typeof payload.errcode === 'number') {
      throw new BadGatewayException(
        `Wechat miniapp auth exchange failed: ${typeof payload.errmsg === 'string' ? payload.errmsg : `errcode ${payload.errcode}`}`
      );
    }

    const openId = payload.openid?.trim();

    if (!openId) {
      throw new BadGatewayException('Wechat miniapp auth exchange did not return openid');
    }

    return { openId };
  }
}
