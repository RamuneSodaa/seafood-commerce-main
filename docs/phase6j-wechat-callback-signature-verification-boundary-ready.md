# Phase 6J WeChat Callback Signature Verification Boundary Ready

## A. Current state

- Backend callback landing seam already exists at `POST /orders/miniapp-payment-callback`
- Backend callback verification-stage helper already exists as `MiniappPaymentCallbackVerificationService`
- Current callback flow already supports these pre-completion seams:
  - `buildVerificationAttempt(...)`
  - `extractWechatCallbackPayloadForBusinessMapping(...)`
  - `mapVerifiedWechatCallbackToBusinessInput(...)`
- Current callback DTO still accepts only `provider`, optional `callbackPayload`, and optional `raw`
- Current repo can already:
  - accept a callback
  - normalize provider and payload shape
  - extract verification-relevant fields
  - map extracted verified fields into `{ orderNo, paymentRef, paidAmountCents }`
- Current repo still cannot trust the callback as a real payment event because no backend authenticity/signature verification exists yet
- `markPaid(...)` remains a separate later business-completion seam that currently expects:
  - `orderId`
  - `paymentRef`
  - `paidAmountCents`

## B. Why current state is not yet real verification

- Callback can land
- Payload can be normalized, extracted, and mapped
- But the backend still has no callback-authenticity verification step
- No current code proves that callback contents actually came from WeChat
- Therefore callback data is still not trustworthy enough to drive payment completion, payment record creation, order status transition, or inventory reservation

## C. Smallest verification target

- Add one backend verification method dedicated to WeChat callback authenticity
- That verification method should accept only the minimum inputs required for future verification:
  - provider identity: `wechat`
  - raw callback payload object
  - any required WeChat verification configuration read from backend env/config
- On verification success, return one minimal verified callback output shape that is still pre-business-completion:
  - verified provider: `wechat`
  - verified callback payload object
  - extracted verification-relevant fields:
    - `merchantOrderNo`
    - `transactionId`
    - `paidAmountCents`
- On verification failure, fail explicitly and do not produce verified callback output
- Verification success must remain explicitly separate from business completion:
  - verification success only means "callback authenticity is trusted"
  - it must not yet call `markPaid(...)`
  - it must not yet mutate order, payment, or inventory state

## D. Explicitly out of scope

- Calling `markPaid(...)`
- Order mutation
- Refunds
- Reconciliation
- Multi-provider abstraction
- Web payment migration

## E. Single smallest next code task

- Add one minimal `verifyWechatCallbackSignature(...)` helper method on `MiniappPaymentCallbackVerificationService` that accepts the current raw callback payload object, reads the minimum required WeChat verification config from backend env, and fails with a clear not-implemented verification error until real authenticity checking is added.
