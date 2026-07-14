import { markPaid } from './api';
import { CURRENT_STOREFRONT_PROFILE } from './config';

type CustomerPaymentTransitionInput = {
  orderId: string;
  paidAmountCents: number;
};

export type CustomerPaymentTransitionResult = {
  mode: 'mock' | 'wechat-placeholder';
  success: boolean;
  message: string;
};

export async function runCustomerPaymentTransition(
  input: CustomerPaymentTransitionInput
): Promise<CustomerPaymentTransitionResult> {
  if (CURRENT_STOREFRONT_PROFILE.paymentMode === 'wechat-placeholder') {
    return {
      mode: 'wechat-placeholder',
      success: false,
      message: '当前支付模式尚未接入真实实现，请先保持 mock 模式。'
    };
  }

  await markPaid(input.orderId, `manual-${Date.now()}`, input.paidAmountCents);

  return {
    mode: CURRENT_STOREFRONT_PROFILE.paymentMode,
    success: true,
    message: '支付已完成，订单状态已刷新。'
  };
}
