# Phase 6F Miniapp Payment Callback Verification Skeleton Ready

## A. What was added

- Kept `POST /orders/miniapp-payment-callback` as the callback seam
- Added `MiniappPaymentCallbackVerificationService` in the `orders` module as the future verification boundary
- Callback handling now parses provider and callback payload into a structured verification-stage attempt before failing
- Added focused tests for controller forwarding and callback verification skeleton behavior

## B. What was intentionally not implemented

- No real provider signature verification
- No callback-to-order mapping or payment completion
- No `markPaid(...)` call
- No payment record, order state, inventory state, or frontend changes

## C. How to verify

- Run focused callback-related API tests in `apps/api`
- Run `npx tsc -p apps/api/tsconfig.json --noEmit`
- Confirm unsupported providers fail early and supported `wechat` callbacks fail as structured `CALLBACK_VERIFICATION` not-implemented responses

## D. Phase conclusion

Phase 6F upgrades the callback landing seam into the smallest verification skeleton. The backend now has a dedicated verification boundary without claiming real verification or payment completion.
