# Phase 2 Pricing Contract Placeholder Ready

## 1. Current `quoteListPrice()` return shape

`OrderPricingService.quoteListPrice()` currently returns:
- `totalAmountCents`
- `lines: [{ skuId, quantity, unitPriceCents, lineTotalCents }]`

## 2. Suggested minimal future pricing quote shape

The future pricing quote should stay minimal and backend-owned. A reasonable next-step shape is:
- `totalAmountCents`
- `lines: [{ skuId, quantity, unitPriceCents, lineTotalCents }]`
- optional future pricing summary fields added only when truly needed by backend pricing output

The final payable amount must always come back from the backend pricing service.

## 3. What storefront / miniapp may submit in the future

Storefront web and miniapp must not decide the final成交价. They may at most submit lightweight identifiers such as:
- `couponCode`
- `promotionId`

They should never calculate or override the final order total on their own.

## 4. Recommended order amount snapshot fields

When pricing extensions are eventually introduced, the order snapshot should keep the backend-confirmed pricing result, with at minimum:
- final `totalAmountCents`
- per-line `unitPriceCents`

Any future discount snapshot fields should still come from backend pricing output, not from frontend-calculated values.

## 5. Explicitly out of scope now

This stage does not implement:
- real coupons
- real promotions
- points
- viral growth
- pricing rule engine changes

It also does not change the existing order creation main flow.

## 6. Next smallest implementation step

The next smallest step is to define a minimal optional pricing input contract on the backend order creation path, so frontend clients can later pass `couponCode` or `promotionId`, while final amount calculation still remains fully centralized in the backend pricing service.
