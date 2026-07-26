import {
  STOREFRONT_CUSTOMER_TRANSACTION_HOLD_MESSAGE
} from './api';

type CustomerPaymentTransitionInput = {
  orderId: string;
  paidAmountCents: number;
};

export type CustomerPaymentTransitionResult = {
  mode: 'wechat-placeholder';
  success: false;
  message: string;
};

export async function runCustomerPaymentTransition(
  _input: CustomerPaymentTransitionInput
): Promise<CustomerPaymentTransitionResult> {
  return {
    mode: 'wechat-placeholder',
    success: false,
    message: STOREFRONT_CUSTOMER_TRANSACTION_HOLD_MESSAGE
  };
}
