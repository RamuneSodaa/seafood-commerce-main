## A. what was added

- Added one repository lookup seam to resolve an order by verified `orderNo`.
- Upgraded `handleMiniappPaymentCallback(...)` to use verified callback business input and call existing `markPaid(orderId, paymentRef, paidAmountCents)`.
- Froze callback-safe success acknowledgment in code for exactly two completion results:
  - `APPLIED`
  - `IGNORED_DUPLICATE`
- Added focused tests for applied completion, safe duplicate acknowledgment, unresolved `orderNo`, cross-order duplicate conflict, invalid transition, and controller forwarding.

## B. what was intentionally not implemented

- No refunds.
- No reconciliation.
- No admin payment tooling.
- No multi-provider abstraction.
- No frontend or payment UI changes.
- No broader order-flow rewrite beyond the verified callback completion seam.

## C. how to verify

- Run `npx jest --runInBand test/order-workflow.service.smoke.spec.ts test/orders.controller.spec.ts` in `apps/api`.
- Run `npx tsc -p apps/api/tsconfig.json --noEmit` from the repo root.
- Confirm verified callback completion only returns `200`-path success for `APPLIED` and same-order `IGNORED_DUPLICATE`.

## D. phase conclusion

Phase 6N now connects a verified WeChat callback to the existing `markPaid(...)` business path through a minimal `orderNo` lookup seam, while keeping completion behavior narrow and provider scope unchanged.
