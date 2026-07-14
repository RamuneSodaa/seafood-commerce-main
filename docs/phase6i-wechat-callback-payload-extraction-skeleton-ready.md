# Phase 6I WeChat Callback Payload Extraction Skeleton Ready

## A. What was added

- Added `ExtractedWechatMiniappPaymentCallbackPayload` as the minimal intermediate extracted callback payload shape
- Added one helper method on `MiniappPaymentCallbackVerificationService` that extracts only `merchantOrderNo`, `transactionId`, and `paidAmountCents` from a WeChat callback payload object
- Added focused tests for extraction success, missing-field failure, and a local extraction-to-mapping seam

## B. What was intentionally not implemented

- No real signature verification
- No `markPaid(...)` call
- No callback-to-order completion flow
- No payment record, order state, inventory state, or frontend changes

## C. How to verify

- Run focused callback verification/mapping tests in `apps/api`
- Run `npx tsc -p apps/api/tsconfig.json --noEmit`
- Confirm extraction returns only the verification-relevant fields and fails honestly on missing required fields

## D. Phase conclusion

Phase 6I lands the first raw-payload-to-extracted-payload skeleton for WeChat callback handling. The repo now has a dedicated extraction seam before final business-input mapping, without claiming real verification or payment completion.
