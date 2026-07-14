# Phase 2 Coupon E2E Placeholder Ready

## 1. What was added

`couponCode?` is now minimally wired through the order creation path:
- `CreateOrderDto` can receive it
- web and miniapp request types can carry it
- `createOrder()` forwards it into the internal pricing request

## 2. What was intentionally not changed

This stage did not change:
- schema
- API contract behavior
- frontend coupon UI
- order snapshot fields
- payment logic
- inventory reservation
- fulfillment state machine

It also did not implement real coupon validation or discount logic.

## 3. Current end-to-end coupon placeholder semantics

`couponCode` is currently only an end-to-end placeholder. It does not mean coupon support is already available.

Current behavior is:
- backend can receive it
- backend forwards it into pricing request
- backend still ignores it
- backend does not write it into order snapshot
- backend does not change order amount result

## 4. How to verify

Use:
- API tests
- pricing unit tests
- storefront web build
- miniapp build

Verification should confirm the order creation main flow result remains unchanged.

## 5. Current phase conclusion

The system now has an end-to-end coupon placeholder path, but coupon support is still not implemented. Current pricing remains list-price only, and the order creation main flow result is unchanged.
