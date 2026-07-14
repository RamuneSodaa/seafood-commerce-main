# Phase 2 Coupon Checkout Input Ready

## 1. What was added

Storefront web checkout and storefront miniapp checkout now support a minimal coupon input field. The current behavior only allows manual `couponCode` entry and forwards it through the existing order creation request.

## 2. What was intentionally not changed

This stage did not add:
- frontend coupon pre-validation
- coupon list
- auto-applied coupon behavior
- validate-coupon button
- real-time discounted price preview

It also did not change inventory, payment, or fulfillment main flow behavior.

## 3. Current checkout coupon input semantics

Current behavior is:
- customer manually enters `couponCode`
- value is trimmed before submit
- empty trimmed value is not sent
- only explicit backend `Invalid coupon code` is mapped to a dedicated coupon error message
- all other order creation errors continue to use the original general error path

## 4. How to verify

Check:
- empty coupon input
- valid `WELCOME-1000`
- invalid coupon code
- storefront web checkout
- storefront miniapp checkout

Verification should confirm the coupon input is forwarded correctly without changing the existing order flow.

## 5. Current phase conclusion

The system now has a minimal checkout coupon input entry on both customer surfaces, while coupon UX remains intentionally MVP-level and the inventory / payment / fulfillment main flow remains unchanged.
