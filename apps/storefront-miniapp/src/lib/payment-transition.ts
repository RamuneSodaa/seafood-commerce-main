import { createMiniappPayment, markPaid } from './api';
import { CURRENT_MINIAPP_PROFILE } from './config';
import { getMiniappIdentitySource } from './identity';
import { getStoredCustomerAuthArtifact } from './identity-storage';
import { launchWechatMiniappPayment } from './wechat-payment-launch';

type CustomerPaymentTransitionInput = {
  orderId: string;
  paidAmountCents: number;
};

const MERCHANT_PAYMENT_REVIEW_MESSAGE = '商户支付功能正在审核中，当前暂不可支付，请稍后重试或联系商家。';

export type CustomerPaymentTransitionResult = {
  mode: 'mock' | 'wechat-placeholder' | 'wechat';
  success: boolean;
  message: string;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === 'string' ? error : '';
}

function isMerchantPaymentReviewError(message: string): boolean {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes('no_auth') ||
    message.includes('收款功能已被限制') ||
    message.includes('此商家的收款功能已被限制') ||
    message.includes('暂无支付')
  );
}

export async function runCustomerPaymentTransition(
  input: CustomerPaymentTransitionInput
): Promise<CustomerPaymentTransitionResult> {
  if (getMiniappIdentitySource() === 'real-storage') {
    const storedAuthArtifact = getStoredCustomerAuthArtifact();

    if (!storedAuthArtifact) {
      throw new Error('当前支付需要重新完成微信登录，请重新登录后再试。');
    }

    try {
      const payment = await createMiniappPayment(input.orderId);
      const launch = await launchWechatMiniappPayment(payment.launchParams);

      if (launch.result !== 'LAUNCHED') {
        if (isMerchantPaymentReviewError(launch.message)) {
          console.warn('Wechat miniapp payment launch restricted by merchant review:', launch.message);

          return {
            mode: payment.provider,
            success: false,
            message: MERCHANT_PAYMENT_REVIEW_MESSAGE
          };
        }

        return {
          mode: payment.provider,
          success: false,
          message: launch.message
        };
      }

      return {
        mode: payment.provider,
        success: true,
        message: `${payment.orderNo} 已拉起微信支付，请等待支付结果回调刷新订单状态。`
      };
    } catch (error) {
      const message = getErrorMessage(error);

      if (isMerchantPaymentReviewError(message)) {
        console.warn('Wechat miniapp payment create failed because merchant payment is under review:', error);

        return {
          mode: 'wechat',
          success: false,
          message: MERCHANT_PAYMENT_REVIEW_MESSAGE
        };
      }

      throw error;
    }
  }

  if (CURRENT_MINIAPP_PROFILE.paymentMode === 'wechat-placeholder') {
    return {
      mode: 'wechat-placeholder',
      success: false,
      message: '当前支付方式暂未开放，请稍后重试或联系商家。'
    };
  }

  await markPaid(input.orderId, `manual-${Date.now()}`, input.paidAmountCents);

  return {
    mode: CURRENT_MINIAPP_PROFILE.paymentMode,
    success: true,
    message: '支付已完成，订单状态已刷新。'
  };
}
