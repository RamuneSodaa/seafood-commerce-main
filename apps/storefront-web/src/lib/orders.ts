import type { FulfillmentType, OrderStatus, OrderSummary } from './api';

export function formatDateTime(value?: string | null): string {
  if (!value) return '暂未生成';

  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

export function getOrderItemCount(order: Pick<OrderSummary, 'items'>): number {
  return order.items.reduce((total, item) => total + item.quantity, 0);
}

export function getOrderStatusMeta(status: OrderStatus): {
  label: string;
  tone: 'accent' | 'success' | 'neutral';
  description: string;
} {
  switch (status) {
    case 'PENDING_PAYMENT':
      return {
        label: '待支付',
        tone: 'accent',
        description: '订单已创建，完成支付后才会锁定库存并继续履约。'
      };
    case 'PAID_PENDING_PREP':
      return {
        label: '待备货',
        tone: 'accent',
        description: '订单已支付，门店正在准备自提商品。'
      };
    case 'READY_FOR_PICKUP':
      return {
        label: '待取货',
        tone: 'success',
        description: '订单已备妥，顾客可凭提货码到店取货。'
      };
    case 'COMPLETED':
      return {
        label: '已完成',
        tone: 'success',
        description: '自提订单已完成交付。'
      };
    case 'PAID_PENDING_SHIPMENT':
      return {
        label: '待发货',
        tone: 'accent',
        description: '订单已支付，正在等待门店打包发货。'
      };
    case 'SHIPPED':
      return {
        label: '已发货',
        tone: 'accent',
        description: '订单已出库，正在配送途中。'
      };
    case 'DELIVERED':
      return {
        label: '已送达',
        tone: 'success',
        description: '物流已完成签收。'
      };
    case 'CANCELLED':
      return {
        label: '已取消',
        tone: 'neutral',
        description: '订单已取消，当前流程不会继续推进。'
      };
    case 'AFTER_SALES':
      return {
        label: '售后中',
        tone: 'neutral',
        description: '订单已进入售后处理阶段。'
      };
    default:
      return {
        label: status,
        tone: 'neutral',
        description: '当前订单状态。'
      };
  }
}

export function getFulfillmentMeta(fulfillmentType: FulfillmentType): {
  label: string;
  description: string;
} {
  return fulfillmentType === 'STORE_PICKUP'
    ? {
        label: '到店自提',
        description: '顾客到所选门店完成核销取货。'
      }
    : {
        label: '邮寄发货',
        description: '订单完成打包后通过物流寄送。'
      };
}

export function getOrderNextStep(order: Pick<OrderSummary, 'status' | 'fulfillmentType'>): string {
  switch (order.status) {
    case 'PENDING_PAYMENT':
      return '下一步：完成支付后系统会锁定库存并继续订单流程。';
    case 'PAID_PENDING_PREP':
      return '下一步：等待门店完成备货并通知可取。';
    case 'READY_FOR_PICKUP':
      return '下一步：携带提货码到店取货。';
    case 'COMPLETED':
      return '该自提订单已完成。';
    case 'PAID_PENDING_SHIPMENT':
      return '下一步：等待门店创建物流单并发货。';
    case 'SHIPPED':
      return '下一步：关注物流进度，等待送达。';
    case 'DELIVERED':
      return '该邮寄订单已送达。';
    case 'CANCELLED':
      return '该订单已取消，无需后续操作。';
    case 'AFTER_SALES':
      return '该订单当前正在售后处理中。';
    default:
      return '请关注当前状态，等待下一次更新。';
  }
}

export function getOrderPrimaryItemLabel(order: Pick<OrderSummary, 'items'>): string {
  const firstItem = order.items[0];
  if (!firstItem) return '暂无商品';
  if (order.items.length === 1) return '已选 1 个 SKU';
  return `共 ${order.items.length} 个 SKU`;
}

export function formatOrderStatusReason(reason?: string | null): string {
  if (!reason) return '状态已更新。';
  if (reason.startsWith('payment marked:')) {
    return `支付完成：${reason.replace('payment marked:', '').trim()}`;
  }
  if (reason === 'order created') return '订单已创建。';
  if (reason === 'store prepared') return '门店已完成备货。';
  if (reason === 'pickup completed') return '顾客已完成取货。';
  if (reason === 'shipment created and shipped') return '已创建物流并完成发货。';
  if (reason === 'shipping delivered') return '订单已确认送达。';
  if (reason === 'cancelled by user/admin') return '订单已取消。';
  return reason;
}
