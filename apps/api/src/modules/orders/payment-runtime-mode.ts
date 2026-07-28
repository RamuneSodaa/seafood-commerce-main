import { ServiceUnavailableException } from '@nestjs/common';

export type PaymentRuntimeMode = 'disabled' | 'wechat_live';

export function readPaymentRuntimeMode(rawValue = process.env.PAYMENT_RUNTIME_MODE): PaymentRuntimeMode {
  const normalized = rawValue?.trim().toLowerCase();

  if (!normalized || normalized === 'disabled') {
    return 'disabled';
  }

  if (normalized === 'wechat_live') {
    return 'wechat_live';
  }

  throw new ServiceUnavailableException(
    'PAYMENT_RUNTIME_MODE_INVALID: payment remains disabled'
  );
}

export function assertWechatLivePaymentEnabled(): void {
  if (readPaymentRuntimeMode() !== 'wechat_live') {
    throw new ServiceUnavailableException(
      'PAYMENT_RUNTIME_DISABLED: 微信支付暂未开放'
    );
  }
}
