import Taro from '@tarojs/taro';
import type { MiniappPaymentLaunchParams } from './api';

type WechatMiniappPaymentLaunchResult =
  | { result: 'LAUNCHED'; message: string }
  | { result: 'CANCELLED'; message: string }
  | { result: 'FAILED'; message: string };

function getRequestPaymentErrorMessage(error: unknown): string {
  if (typeof error !== 'object' || error === null) return '';

  const errMsg = 'errMsg' in error && typeof error.errMsg === 'string' ? error.errMsg.trim() : '';
  return errMsg;
}

export async function launchWechatMiniappPayment(
  launchParams: MiniappPaymentLaunchParams
): Promise<WechatMiniappPaymentLaunchResult> {
  try {
    await Taro.requestPayment({
      timeStamp: launchParams.timeStamp,
      nonceStr: launchParams.nonceStr,
      package: launchParams.package,
      signType: launchParams.signType,
      paySign: launchParams.paySign
    });

    return {
      result: 'LAUNCHED',
      message: '已拉起微信支付，请等待支付结果回调刷新订单状态。'
    };
  } catch (error) {
    const errMsg = getRequestPaymentErrorMessage(error).toLowerCase();

    if (errMsg.includes('cancel')) {
      return {
        result: 'CANCELLED',
        message: '你已取消本次微信支付。'
      };
    }

    return {
      result: 'FAILED',
      message: errMsg ? `微信支付拉起失败：${errMsg}` : '微信支付拉起失败，请重试。'
    };
  }
}
