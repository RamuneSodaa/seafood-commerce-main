import { OrderPricingService } from '../src/modules/pricing/order-pricing.service';

describe('OrderPricingService', () => {
  test('quoteListPrice matches sum of sku price times quantity', () => {
    const pricing = new OrderPricingService();
    const skuMap = new Map([
      ['a', { priceCents: 1000 }],
      ['b', { priceCents: 500 }]
    ]);
    const quote = pricing.quoteListPrice({
      items: [
        { skuId: 'a', quantity: 2 },
        { skuId: 'b', quantity: 1 }
      ],
      priceMap: skuMap
    });

    expect(quote.subtotalAmountCents).toBe(2500);
    expect(quote.discountAmountCents).toBe(0);
    expect(quote.totalAmountCents).toBe(2500);
    expect(quote.adjustments).toEqual([]);
    expect(quote.appliedCouponCode).toBeUndefined();
    expect(quote.lines).toEqual([
      {
        skuId: 'a',
        quantity: 2,
        listUnitPriceCents: 1000,
        unitPriceCents: 1000,
        memberUnitPriceCents: null,
        lineSubtotalCents: 2000,
        lineMemberDiscountCents: 0,
        lineTotalCents: 2000
      },
      {
        skuId: 'b',
        quantity: 1,
        listUnitPriceCents: 500,
        unitPriceCents: 500,
        memberUnitPriceCents: null,
        lineSubtotalCents: 500,
        lineMemberDiscountCents: 0,
        lineTotalCents: 500
      }
    ]);
  });

  test('quoteListPrice preserves duplicate SKU lines and original order', () => {
    const pricing = new OrderPricingService();
    const skuMap = new Map([['a', { priceCents: 1000 }]]);

    const quote = pricing.quoteListPrice({
      items: [
        { skuId: 'a', quantity: 1 },
        { skuId: 'a', quantity: 3 }
      ],
      priceMap: skuMap
    });

    expect(quote.subtotalAmountCents).toBe(4000);
    expect(quote.discountAmountCents).toBe(0);
    expect(quote.totalAmountCents).toBe(4000);
    expect(quote.appliedCouponCode).toBeUndefined();
    expect(quote.lines).toEqual([
      {
        skuId: 'a',
        quantity: 1,
        listUnitPriceCents: 1000,
        unitPriceCents: 1000,
        memberUnitPriceCents: null,
        lineSubtotalCents: 1000,
        lineMemberDiscountCents: 0,
        lineTotalCents: 1000
      },
      {
        skuId: 'a',
        quantity: 3,
        listUnitPriceCents: 1000,
        unitPriceCents: 1000,
        memberUnitPriceCents: null,
        lineSubtotalCents: 3000,
        lineMemberDiscountCents: 0,
        lineTotalCents: 3000
      }
    ]);
  });

  test('quoteListPrice applies fixed-amount coupon when coupon code is valid', () => {
    const pricing = new OrderPricingService();
    const skuMap = new Map([['a', { priceCents: 1200 }]]);

    const quote = pricing.quoteListPrice({
      items: [{ skuId: 'a', quantity: 2 }],
      priceMap: skuMap,
      couponCode: 'WELCOME-1000'
    });

    expect(quote.subtotalAmountCents).toBe(2400);
    expect(quote.discountAmountCents).toBe(1000);
    expect(quote.totalAmountCents).toBe(1400);
    expect(quote.appliedCouponCode).toBe('WELCOME-1000');
    expect(quote.adjustments).toEqual([{ code: 'WELCOME-1000', label: '优惠码', amountCents: 1000 }]);
    expect(quote.lines).toEqual([{
      skuId: 'a',
      quantity: 2,
      listUnitPriceCents: 1200,
      unitPriceCents: 1200,
      memberUnitPriceCents: null,
      lineSubtotalCents: 2400,
      lineMemberDiscountCents: 0,
      lineTotalCents: 2400
    }]);
  });

  test('quoteListPrice caps discount at subtotal amount', () => {
    const pricing = new OrderPricingService();
    const skuMap = new Map([['a', { priceCents: 300 }]]);

    const quote = pricing.quoteListPrice({
      items: [{ skuId: 'a', quantity: 1 }],
      priceMap: skuMap,
      couponCode: 'WELCOME-1000'
    });

    expect(quote.subtotalAmountCents).toBe(300);
    expect(quote.discountAmountCents).toBe(300);
    expect(quote.totalAmountCents).toBe(0);
    expect(quote.appliedCouponCode).toBe('WELCOME-1000');
    expect(quote.adjustments).toEqual([{ code: 'WELCOME-1000', label: '优惠码', amountCents: 300 }]);
  });

  test('quoteListPrice rejects invalid coupon code', () => {
    const pricing = new OrderPricingService();
    const skuMap = new Map([['a', { priceCents: 1000 }]]);

    expect(() =>
      pricing.quoteListPrice({
        items: [{ skuId: 'a', quantity: 1 }],
        priceMap: skuMap,
        couponCode: 'INVALID-XXX'
      })
    ).toThrow('优惠码无效。');
  });
});
