# Phase 2 Coupon Request Placeholder Ready

## 1. What was added

The internal `OrderPricingService.quoteListPrice()` method now accepts an internal pricing request object that includes:
- `items`
- `priceMap`
- `couponCode?`

This is only a minimal internal placeholder for future coupon entry.

## 2. What was intentionally not changed

This stage did not change:
- schema
- API contract
- frontend contract
- checkout request shape
- order creation external behavior
- payment logic
- inventory reservation
- fulfillment state machine

## 3. Current coupon placeholder semantics

`couponCode` is currently only an internal pricing request placeholder.

It is:
- not API contract
- not frontend contract
- not used for real coupon validation
- not used for real discount calculation

This stage only reserves the internal request shape for future coupon entry and does not change current order creation result.

## 4. How to verify

Use:
- API tests
- pricing unit tests

Verification should confirm that order amount result and order creation main flow remain unchanged.

## 5. Current phase conclusion

The backend pricing request shape now has a minimal coupon entry placeholder, but current pricing behavior is still list-price only and the order creation main flow result remains unchanged.
