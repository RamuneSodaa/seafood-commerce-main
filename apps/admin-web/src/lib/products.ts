import type { ProductRow } from './api';
import { formatMoney } from './orders';

export function getProductStatusMeta(product: ProductRow): {
  label: string;
  tone: 'success' | 'accent';
  description: string;
} {
  if (product.isPublished) {
    return {
      label: '已发布',
      tone: 'success',
      description: '满足前台浏览条件时，顾客即可在商城看到该商品。'
    };
  }

  return {
    label: '未发布',
    tone: 'accent',
    description: '商品尚未发布，因此不会出现在顾客前台。'
  };
}

export function getProductPriceSummary(product: ProductRow): string {
  if (product.skus.length === 0) return '暂无规格价格';

  const sorted = [...product.skus].sort((a, b) => a.priceCents - b.priceCents);
  const min = sorted[0].priceCents;
  const max = sorted[sorted.length - 1].priceCents;

  if (min === max) return formatMoney(min);
  return `${formatMoney(min)} - ${formatMoney(max)}`;
}

export function getProductMerchandisingHint(product: ProductRow): string {
  if (!product.supportsPickup && !product.supportsShipping) {
    return '当前商品未配置自提或发货能力。';
  }

  if (product.supportsPickup && product.supportsShipping) {
    return '同时支持到店自提与邮寄发货，履约方式更灵活。';
  }

  if (product.supportsPickup) {
    return '仅支持到店自提，顾客下单后需到门店取货。';
  }

  return '仅支持邮寄发货，顾客只能通过配送收货。';
}
