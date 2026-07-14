## A. what was added

- Hardened `POST /orders/miniapp-payment-callback` at the controller boundary to return the fixed provider-safe success body `{ acknowledged: true }`.
- Applied that same `200` acknowledgment body to exactly two verified completion results:
  - `APPLIED`
  - `IGNORED_DUPLICATE`
- Added focused controller tests for applied acknowledgment, safe-duplicate acknowledgment, and failure passthrough.

## B. what was intentionally not implemented

- No refunds.
- No reconciliation.
- No multi-provider abstraction.
- No frontend changes.
- No broader order or payment refactor.

## C. how to verify

- Run `npx jest --runInBand test/orders.controller.spec.ts test/order-workflow.service.smoke.spec.ts` in `apps/api`.
- Run `npx tsc -p apps/api/tsconfig.json --noEmit` from the repo root.
- Confirm the callback route only returns `{ acknowledged: true }` on the `200` path for `APPLIED` and same-order `IGNORED_DUPLICATE`, while failures still throw through the existing API error flow.

## D. phase conclusion

Phase 6P hardens the WeChat callback acknowledgment contract at the route boundary without changing verified completion behavior, failure semantics, or broader payment scope.
