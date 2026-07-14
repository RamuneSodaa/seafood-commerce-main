import { BadRequestException, Injectable } from '@nestjs/common';
import { CouponDiscountType, type CouponTemplate } from '@prisma/client';

export type OrderPricingInputItem = {
  skuId: string;
  quantity: number;
};

export type OrderPricingSkuSnapshot = {
  priceCents: number;
  memberPriceCents?: number | null;
};

export type OrderPricingCouponSnapshot = {
  id: string;
  template: CouponTemplate;
};

export type OrderPricingRequest = {
  items: OrderPricingInputItem[];
  priceMap: Map<string, OrderPricingSkuSnapshot>;
  coupon?: OrderPricingCouponSnapshot | null;
  coupons?: OrderPricingCouponSnapshot[];
  couponCode?: string;
};

export type OrderPriceLine = {
  skuId: string;
  quantity: number;
  listUnitPriceCents: number;
  unitPriceCents: number;
  memberUnitPriceCents?: number | null;
  lineSubtotalCents: number;
  lineMemberDiscountCents: number;
  lineTotalCents: number;
};

export type OrderPriceAdjustment = {
  code: string;
  label: string;
  amountCents: number;
};

export type OrderPriceQuote = {
  subtotalAmountCents: number;
  baseAmountCents: number;
  memberDiscountAmountCents: number;
  couponDiscountAmountCents: number;
  discountAmountCents: number;
  totalAmountCents: number;
  lines: OrderPriceLine[];
  adjustments: OrderPriceAdjustment[];
  appliedCouponCode?: string;
  appliedUserCouponId?: string;
  appliedCouponCodes: string[];
  appliedUserCouponIds: string[];
  couponApplications: Array<{
    userCouponId: string;
    couponTemplateId: string;
    couponCodeSnapshot: string;
    couponNameSnapshot: string;
    amountCents: number;
  }>;
};

@Injectable()
export class OrderPricingService {
  quoteListPrice(request: OrderPricingRequest): OrderPriceQuote {
    const coupons = request.coupons || (request.coupon ? [request.coupon] : []);
    const { items, priceMap } = request;
    let baseAmountCents = 0;
    let memberSubtotalAmountCents = 0;
    const lines: OrderPriceLine[] = [];

    for (const item of items) {
      const sku = priceMap.get(item.skuId);
      if (!sku) {
        throw new BadRequestException('商品规格价格缺失。');
      }

      const listUnitPriceCents = sku.priceCents;
      const memberUnitPriceCents = sku.memberPriceCents ?? null;
      const unitPriceCents = memberUnitPriceCents && memberUnitPriceCents > 0
        ? Math.min(listUnitPriceCents, memberUnitPriceCents)
        : listUnitPriceCents;
      const lineSubtotalCents = listUnitPriceCents * item.quantity;
      const lineTotalCents = unitPriceCents * item.quantity;
      const lineMemberDiscountCents = lineSubtotalCents - lineTotalCents;

      baseAmountCents += lineSubtotalCents;
      memberSubtotalAmountCents += lineTotalCents;
      lines.push({
        skuId: item.skuId,
        quantity: item.quantity,
        listUnitPriceCents,
        unitPriceCents,
        memberUnitPriceCents,
        lineSubtotalCents,
        lineMemberDiscountCents,
        lineTotalCents
      });
    }

    const memberDiscountAmountCents = baseAmountCents - memberSubtotalAmountCents;
    let couponDiscountAmountCents = 0;
    const adjustments: OrderPriceAdjustment[] = [];

    if (memberDiscountAmountCents > 0) {
      adjustments.push({
        code: 'MEMBER_PRICE',
        label: '会员优惠',
        amountCents: memberDiscountAmountCents
      });
    }

    const couponApplications: OrderPriceQuote['couponApplications'] = [];

    if (coupons.length > 0) {
      const stackBlockedCoupon = coupons.find((item) => !item.template.canStack);
      if (stackBlockedCoupon && coupons.length > 1) {
        throw new BadRequestException(`${stackBlockedCoupon.template.name} 暂不支持与其他优惠券叠加使用。`);
      }

      let remainingCouponBaseCents = memberSubtotalAmountCents;
      const sortedCoupons = [...coupons].sort((a, b) => b.template.priority - a.template.priority);

      for (const coupon of sortedCoupons) {
        const template = coupon.template;
        if (memberSubtotalAmountCents < template.thresholdAmountCents) {
          throw new BadRequestException(`${template.name} 未达到使用门槛。`);
        }

        let currentDiscountAmountCents = 0;
        if (template.discountType === CouponDiscountType.AMOUNT_OFF) {
          currentDiscountAmountCents = Math.max(0, template.discountAmountCents || 0);
        } else if (template.discountType === CouponDiscountType.PERCENT_OFF) {
          const discountPercent = Math.max(0, Math.min(100, template.discountPercent || 0));
          currentDiscountAmountCents = Math.floor(memberSubtotalAmountCents * discountPercent / 100);
          if (template.maxDiscountAmountCents !== null && template.maxDiscountAmountCents !== undefined) {
            currentDiscountAmountCents = Math.min(currentDiscountAmountCents, template.maxDiscountAmountCents);
          }
        }

        currentDiscountAmountCents = Math.min(currentDiscountAmountCents, remainingCouponBaseCents);

        if (currentDiscountAmountCents <= 0) {
          continue;
        }

        couponDiscountAmountCents += currentDiscountAmountCents;
        remainingCouponBaseCents -= currentDiscountAmountCents;
        adjustments.push({
          code: template.code,
          label: template.name,
          amountCents: currentDiscountAmountCents
        });
        couponApplications.push({
          userCouponId: coupon.id,
          couponTemplateId: template.id,
          couponCodeSnapshot: template.code,
          couponNameSnapshot: template.name,
          amountCents: currentDiscountAmountCents
        });
      }
    } else if (request.couponCode?.trim()) {
      const legacyCouponCode = request.couponCode.trim();
      if (legacyCouponCode !== 'WELCOME-1000') {
        throw new BadRequestException('优惠码无效。');
      }

      couponDiscountAmountCents = Math.min(1000, memberSubtotalAmountCents);
      adjustments.push({
        code: legacyCouponCode,
        label: '优惠码',
        amountCents: couponDiscountAmountCents
      });
    }

    const discountAmountCents = memberDiscountAmountCents + couponDiscountAmountCents;
    const totalAmountCents = Math.max(0, baseAmountCents - discountAmountCents);

    return {
      subtotalAmountCents: baseAmountCents,
      baseAmountCents,
      memberDiscountAmountCents,
      couponDiscountAmountCents,
      discountAmountCents,
      totalAmountCents,
      lines,
      adjustments,
      appliedCouponCode: couponApplications[0]?.couponCodeSnapshot || request.couponCode?.trim(),
      appliedUserCouponId: couponApplications[0]?.userCouponId,
      appliedCouponCodes: couponApplications.map((application) => application.couponCodeSnapshot),
      appliedUserCouponIds: couponApplications.map((application) => application.userCouponId),
      couponApplications
    };
  }
}
