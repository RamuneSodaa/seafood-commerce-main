import type { OrderItemSummary, OrderSummary } from './api';

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID_PENDING_PREP'
  | 'READY_FOR_PICKUP'
  | 'COMPLETED'
  | 'PAID_PENDING_SHIPMENT'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'AFTER_SALES';

export type FulfillmentType = 'STORE_PICKUP' | 'SHIPPING';

export function formatDateTime(value?: string | null): string {
  if (!value) return '暂未生成';

  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

export function formatMoney(amountCents: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2
  }).format(amountCents / 100);
}

export function getStatusMeta(status: OrderStatus): {
  label: string;
  tone: 'neutral' | 'accent' | 'success' | 'danger';
  description: string;
} {
  switch (status) {
    case 'PENDING_PAYMENT':
      return {
        label: '待支付',
        tone: 'accent',
        description: '订单尚未支付，支付前不会锁定库存或进入履约。'
      };
    case 'PAID_PENDING_PREP':
      return {
        label: '待备货',
        tone: 'accent',
        description: '自提订单已支付，正在等待门店备货。'
      };
    case 'READY_FOR_PICKUP':
      return {
        label: '待取货',
        tone: 'success',
        description: '顾客可携带提货码到店取货。'
      };
    case 'COMPLETED':
      return {
        label: '已完成',
        tone: 'success',
        description: '自提订单已成功完成。'
      };
    case 'PAID_PENDING_SHIPMENT':
      return {
        label: '待发货',
        tone: 'accent',
        description: '邮寄订单已支付，等待创建物流并交给承运方。'
      };
    case 'SHIPPED':
      return {
        label: '已发货',
        tone: 'accent',
        description: '物流单已创建，订单已发出。'
      };
    case 'DELIVERED':
      return {
        label: '已送达',
        tone: 'success',
        description: '物流已确认送达。'
      };
    case 'CANCELLED':
      return {
        label: '已取消',
        tone: 'danger',
        description: '订单已取消，不再继续后续流程。'
      };
    case 'AFTER_SALES':
      return {
        label: '售后中',
        tone: 'neutral',
        description: '订单当前处于售后处理阶段。'
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
        description: '门店备货后，顾客到店核销提货。'
      }
    : {
        label: '邮寄发货',
        description: '完成打包与发货后，跟踪配送直至送达。'
      };
}

export function getItemCount(items: Array<{ quantity: number }>): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export function getOrderStoreName(order: Pick<OrderSummary, 'store' | 'storeId'>): string {
  return order.store?.name?.trim() || '未关联门店';
}

export function getOrderItemDisplayName(item: OrderItemSummary): string {
  return item.sku?.product?.name?.trim() || '商品明细';
}

export function getOrderItemSpecName(item: OrderItemSummary): string {
  return item.sku?.name?.trim() || '规格信息暂未同步';
}

export function getOrderItemSkuCode(item: OrderItemSummary): string {
  return item.sku?.code?.trim() || item.skuId;
}

export function getOrderMainItemSummary(order: Pick<OrderSummary, 'items'>): string {
  const firstItem = order.items[0];
  if (!firstItem) return '暂无商品明细';

  const firstName = getOrderItemDisplayName(firstItem);
  const itemKinds = order.items.length;
  if (itemKinds <= 1) return firstName;
  return `${firstName}等 ${itemKinds} 款商品`;
}

export function getOrderPickupOrTrackingLabel(order: Pick<OrderSummary, 'fulfillmentType' | 'pickupRecord' | 'shipment'>): {
  label: string;
  value: string;
} {
  if (order.fulfillmentType === 'STORE_PICKUP') {
    return {
      label: '提货码',
      value: order.pickupRecord?.pickupCode || '暂未生成'
    };
  }

  return {
    label: '运单号',
    value: order.shipment?.trackingNumber || '暂未生成'
  };
}

export function getNextActionHint(status: OrderStatus, fulfillmentType: FulfillmentType): string {
  if (status === 'PENDING_PAYMENT') return '等待支付完成后再继续门店侧处理。';
  if (status === 'PAID_PENDING_PREP' && fulfillmentType === 'STORE_PICKUP') return '优先动作：完成备货后标记为待取货。';
  if (status === 'READY_FOR_PICKUP') return '优先动作：核验提货码并完成取货。';
  if (status === 'PAID_PENDING_SHIPMENT' && fulfillmentType === 'SHIPPING') return '优先动作：创建物流单并交接承运方。';
  if (status === 'SHIPPED') return '优先动作：货物送达后确认妥投。';
  if (status === 'COMPLETED' || status === 'DELIVERED') return '当前订单已完成，无需继续履约。';
  if (status === 'CANCELLED') return '已取消订单不可再执行后续动作。';
  return '请根据当前状态执行对应订单流程。';
}

// Phase 2.49D：鲜鱼预订单（FRESH_PREORDER）后台展示语义。
// 鲜鱼预订单借用 PENDING_PAYMENT 状态承载，但不走线上支付、需门店称重确认；
// 故后台不可沿用普通「待支付 / 等待支付完成」文案，统一覆写为门店称重确认语义。
export const FRESH_PREORDER_BADGE_LABEL = '鲜鱼预订';
export const FRESH_PREORDER_STATUS_LABEL = '待门店称重确认';
export const FRESH_PREORDER_STATUS_DESCRIPTION = '鲜鱼预订单不在线支付，参考价仅供预订，实际价格以门店称重为准。';
export const FRESH_PREORDER_NEXT_ACTION_HINT = '以门店称重确认实际数量与金额；该订单不走线上支付。';

export function isFreshPreorder(order: Pick<OrderSummary, 'isFreshPreorder'>): boolean {
  return order.isFreshPreorder === true;
}

// Phase 2.49H：鲜鱼预订 stage → 中文文案（与后端 freshStageMeta 对齐）。
export function getFreshStageLabel(stage?: string | null): string {
  switch (stage) {
    case 'PENDING_STORE_CONFIRMATION':
      return '待门店称重确认';
    case 'CONFIRMED_WAITING_PICKUP':
      return '已确认 · 待取货/线下结算';
    case 'COMPLETED_OFFLINE_SETTLED':
      return '已完成 · 线下结算';
    case 'CANCELLED':
      return '已取消';
    default:
      return FRESH_PREORDER_STATUS_LABEL;
  }
}

// 鲜鱼预订单覆写普通状态徽标与描述；其余订单沿用 getStatusMeta（普通干货逻辑不受影响）。
export function getStatusMetaForOrder(
  order: Pick<OrderSummary, 'status' | 'isFreshPreorder' | 'freshPreorderDetail'>
): ReturnType<typeof getStatusMeta> {
  if (isFreshPreorder(order)) {
    const stage = order.freshPreorderDetail?.stage;
    return {
      label: getFreshStageLabel(stage),
      tone: stage === 'CANCELLED' ? 'danger' : stage === 'COMPLETED_OFFLINE_SETTLED' ? 'success' : 'accent',
      description: FRESH_PREORDER_STATUS_DESCRIPTION
    };
  }
  return getStatusMeta(order.status);
}

// 鲜鱼预订单覆写「等待支付完成」误导文案；其余订单沿用 getNextActionHint。
export function getNextActionHintForOrder(
  order: Pick<OrderSummary, 'status' | 'fulfillmentType' | 'isFreshPreorder' | 'freshPreorderActionHint'>
): string {
  if (isFreshPreorder(order)) return order.freshPreorderActionHint || FRESH_PREORDER_NEXT_ACTION_HINT;
  return getNextActionHint(order.status, order.fulfillmentType);
}

// Phase 2.49H：鲜鱼预订金额——有最终价显示最终价，否则显示参考价（estimated 或订单总额）。
export function getFreshDisplayAmountCents(
  order: Pick<OrderSummary, 'isFreshPreorder' | 'freshPreorderDetail' | 'totalAmountCents'>
): { amountCents: number; isFinal: boolean } {
  const final = order.freshPreorderDetail?.finalTotalCents;
  if (isFreshPreorder(order) && final != null) return { amountCents: final, isFinal: true };
  const est = order.freshPreorderDetail?.estimatedTotalCents;
  return { amountCents: est ?? order.totalAmountCents, isFinal: false };
}

export function formatStatusLogReason(reason?: string | null): string {
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

export function getShippingFormHint(status: OrderStatus): string {
  if (status === 'PAID_PENDING_SHIPMENT') {
    return '请填写快递公司和运单号后确认发货，系统会立即刷新物流信息。';
  }
  if (status === 'SHIPPED' || status === 'DELIVERED') {
    return '当前订单已生成物流信息，可继续查看发货与送达时间。';
  }
  return '只有处于待发货状态的邮寄订单才可以提交发货信息。';
}
