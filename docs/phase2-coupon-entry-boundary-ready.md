# Phase 2 Coupon Entry Boundary Ready

## 1. What is still missing before minimal coupons

The current system has a backend pricing entry point, but it still only supports list-price calculation. Minimal coupon support still needs:
- a minimal coupon input on the order pricing path
- backend coupon validation
- backend discount calculation
- backend-priced discount snapshot output

## 2. What checkout may submit in the future

Checkout should submit at most a lightweight identifier such as:
- `couponCode`

Frontend must not decide the discount amount on its own.

## 3. Best backend entry point for coupon validation

Coupon validation and discount calculation should happen inside the backend pricing layer, based on the existing `OrderPricingService` entry. This keeps final pricing centralized and avoids breaking the current inventory, payment, and fulfillment state machine.

## 4. Minimal pricing quote / order snapshot additions

When coupon support is introduced, the smallest useful additions are:
- pricing quote:
  - coupon identifier result
  - discount amount result
- order snapshot:
  - final backend-confirmed discount amount
  - final backend-confirmed total amount

These values must come from backend pricing output, not frontend calculations.

## 5. Explicitly out of scope now

This stage does not implement:
- points
- viral growth / referral
- distribution
- group buying
- complex membership system
- multi-coupon stacking

## 6. Next smallest implementation step

The next smallest step is to add one optional `couponCode` input on the backend order pricing path, then validate and price it entirely in the backend pricing layer while keeping the current order creation main flow unchanged.
