# Phase 6G WeChat Callback Verification Input Mapping Boundary Ready

## A. Current state

- Backend callback seam already exists at `POST /orders/miniapp-payment-callback`
- Backend callback verification skeleton helper already exists as `MiniappPaymentCallbackVerificationService`
- Current callback DTO still accepts only `provider`, optional `callbackPayload`, and optional `raw`
- Current callback flow can accept and normalize a `wechat` callback payload, but still stops with a not-implemented verification-stage failure
- Real verification is still missing
- Trusted callback-to-order mapping is still missing
- Trusted callback-to-business-payment input mapping is still missing
- `markPaid(...)` currently expects exactly:
  - `orderId`
  - `paymentRef`
  - `paidAmountCents`
- `markPaid(...)` currently uses `paymentRef` as the durable idempotency key and uses `paidAmountCents` as the persisted paid amount
- Current miniapp payment-create skeleton already returns these future-consistent business-facing fields:
  - `orderId`
  - `orderNo`
  - `totalAmountCents`

## B. Why current state is not yet ready for real verification

- Callback can now land
- Callback can now be normalized into a verification-stage attempt
- But the system still has no frozen rule for which verified WeChat callback fields become trusted business inputs
- Without that mapping boundary, real verification could complete cryptographic checks yet still feed unstable or ambiguous fields into later business completion
- Before real verification is implemented safely, the repo must first freeze which verified callback field maps to order identity, which maps to provider transaction reference, which maps to paid amount, and which fields remain raw/debug only

## C. Smallest mapping target

- Define one normalized verified WeChat callback input shape for business handoff after future verification succeeds
- Use exactly one order-mapping field:
  - verified WeChat merchant order number field -> internal `orderNo`
- Use exactly one provider transaction reference field:
  - verified WeChat transaction id field -> internal `paymentRef`
- Use exactly one paid-amount field:
  - verified WeChat paid amount in cents/fen -> internal `paidAmountCents`
- Keep every other callback field outside the minimal business mapping contract:
  - remain raw/debug only
  - may be logged or retained for future diagnostics
  - must not yet drive order lookup, payment idempotency, or paid amount semantics

## D. Explicitly out of scope

- Actual signature verification
- Calling `markPaid(...)`
- Refunds
- Reconciliation
- Multi-provider abstraction
- Web payment migration

## E. Single smallest next code task

- Add one minimal normalized verified WeChat callback input type plus one helper method that maps a future already-verified WeChat callback payload into exactly `{ orderNo, paymentRef, paidAmountCents }` while leaving all other fields raw-only, but do not call `markPaid(...)` yet.
