# Phase 6E Miniapp Payment Callback Skeleton Ready

## A. What was added

- Added backend callback skeleton route at `POST /orders/miniapp-payment-callback`
- Added minimal `MiniappPaymentCallbackDto` with `provider`, optional `callbackPayload`, and optional `raw`
- Added workflow skeleton method that always fails with a clear not-implemented verification error
- Added focused controller and workflow tests for the new seam

## B. What was intentionally not implemented

- No real provider signature or callback verification
- No callback-to-order mapping or payment completion
- No `markPaid(...)` call
- No payment record, order state, inventory state, or frontend changes

## C. How to verify

- Run focused API tests covering `OrdersController` and `OrderWorkflowService`
- Run `npx tsc -p apps/api/tsconfig.json --noEmit`
- Confirm callback requests reach the new route and fail with `Miniapp payment callback verification is not implemented yet`

## D. Phase conclusion

Phase 6E lands only the first backend miniapp payment callback seam. It creates a fixed future callback entry point without claiming verification or payment completion.
