# Phase 6D Verified Payment Completion Boundary Ready

## A. Current state

- Backend now has one protected miniapp payment-create skeleton route at `POST /orders/:id/create-miniapp-payment`
- That route derives customer scope from the verified auth artifact, checks order access, and only allows `PENDING_PAYMENT`
- The payment-create route still returns only a non-mutating placeholder response:
  - `provider: 'wechat-placeholder'`
  - `initiationType: 'MINIAPP'`
  - `status: 'NOT_IMPLEMENTED'`
- Miniapp order detail can already reach that protected skeleton honestly through the current payment-transition path
- Backend `markPaid(...)` still owns the actual paid-completion business semantics:
  - de-duplicate by `paymentRef`
  - create payment record
  - reserve inventory
  - move status from `PENDING_PAYMENT` to `PAID_PENDING_PREP` or `PAID_PENDING_SHIPMENT`
- No provider callback, webhook, or notify route was found in the repo
- No provider-authenticity verification step was found in the repo

## B. Why current state is not yet verified real payment

- Payment-create now exists
- Miniapp can now reach it
- But the backend still has no trustworthy provider-completion event
- `markPaid(...)` can move business state, but today it still assumes an already-trusted `paymentRef` and amount from the caller
- Without a provider callback / notify seam plus provider-authenticity verification, the backend still cannot honestly claim that a real provider confirmed the payment

## C. Smallest verified payment-completion target

- Add one backend provider-callback seam dedicated to miniapp payment completion
- Add one minimal provider-authenticity verification step on that seam before any business mutation
- After one verified successful provider callback is confirmed, map that event into the existing `markPaid(...)` business transition semantics:
  - reuse `paymentRef` as the provider transaction reference
  - reuse paid amount from verified provider callback data
  - let existing `markPaid(...)` continue to own payment-record creation, inventory reservation, and order-status transition

## D. Explicitly out of scope

- Refunds
- Reconciliation
- Multi-provider abstraction
- Web payment migration
- Admin tooling
- Broad order rewrite

## E. Single smallest next code task

- Add one backend miniapp payment callback skeleton route with a minimal provider-callback DTO and a clear not-implemented verification error path, so the future verified completion seam has a fixed backend landing point before any real mutation is allowed.
