# Phase 2 Coupon Order Detail Display Ready

## 1. What was added

Order detail pages now show the coupon-related pricing snapshot on all three surfaces:
- `subtotalAmountCents`
- `discountAmountCents`
- `totalAmountCents`
- `appliedCouponCode`

## 2. What was intentionally not changed

This stage did not change:
- schema
- API contract
- checkout request shape
- coupon input capability
- order list pages
- pricing rules
- payment, inventory, or fulfillment logic

## 3. Three-surface display summary

The pricing snapshot is now shown on:
- admin order detail
- storefront web order detail
- miniapp order detail

This is read-only display only. No coupon input or coupon action entry was added.

## 4. Historical order fallback behavior

Historical orders degrade safely:
- missing `subtotalAmountCents` falls back to `totalAmountCents`
- missing `discountAmountCents` displays as `0`
- missing `appliedCouponCode` displays as `未使用优惠券`

## 5. How to verify

Check:
- historical orders without pricing snapshot fields
- new orders without coupon
- new orders with `WELCOME-1000`
- all three order detail surfaces

The displayed pricing snapshot should stay readable and should not affect the existing order flow.

## 6. Current phase conclusion

The coupon pricing snapshot is now visible on all order detail pages, while coupon input and broader marketing capabilities remain out of scope for the current phase.
