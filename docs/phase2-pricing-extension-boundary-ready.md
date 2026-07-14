# Phase 2 Pricing Extension Boundary Ready

## 1. Current pricing state

The current order amount is still derived from product SKU price and quantity in the backend order creation flow. Storefront web and miniapp display product price, but they do not own the final transaction amount decision.

## 2. Best future integration layer for coupons and simple promotions

The safest extension point is the backend order pricing layer, directly before order creation is persisted. Coupons or simple promotion rules should be evaluated there, so the final payable amount, order snapshot, inventory reservation, and later payment transition all use the same backend-confirmed price.

## 3. Storefront / miniapp vs backend responsibility boundary

Storefront web and miniapp must not decide the final成交价 on their own. They may at most submit a coupon code or promotion identifier. The backend order pricing layer must remain the single place that validates eligibility and computes the final amount.

## 4. Order amount and snapshot recommendation

When pricing extensions are introduced, the final priced result should be frozen into the order at creation time. The backend should keep the current inventory reservation, payment, and fulfillment state machine intact, and pricing additions must not break those flows.

## 5. Explicitly out of scope now

This stage does not implement:
- points
- viral growth / referral
- distribution
- group buying
- live commerce
- complex membership system

## 6. Next smallest implementation step

The next smallest step is not full marketing delivery. It is to define a minimal backend pricing input shape for order creation, where storefront web and miniapp can later pass a coupon code or simple promotion identifier, while final price calculation still stays fully inside the backend order pricing layer.
