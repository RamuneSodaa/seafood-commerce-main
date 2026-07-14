# Phase 6H Verified WeChat Callback Input Mapping Skeleton Ready

## A. What was added

- Added `VerifiedWechatMiniappPaymentCallbackBusinessInput` as the minimal business-facing mapped callback input type
- Added one helper method on `MiniappPaymentCallbackVerificationService` that maps a future already-verified WeChat callback payload into exactly `orderNo`, `paymentRef`, and `paidAmountCents`
- Added a focused test for the new mapping helper

## B. What was intentionally not implemented

- No real signature verification
- No callback-to-order completion flow
- No `markPaid(...)` call
- No payment record, order state, inventory state, or frontend changes

## C. How to verify

- Run focused callback-related tests in `apps/api`
- Run `npx tsc -p apps/api/tsconfig.json --noEmit`
- Confirm the mapping helper returns only `orderNo`, `paymentRef`, and `paidAmountCents`, while raw/debug callback data remains outside business semantics

## D. Phase conclusion

Phase 6H lands the first code-level callback business-input mapping skeleton for verified WeChat callbacks. The repo now has a fixed normalized handoff seam without claiming real verification or payment completion.
