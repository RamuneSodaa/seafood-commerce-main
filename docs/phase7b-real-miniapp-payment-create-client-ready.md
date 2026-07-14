## A. what was added

- Added one single-purpose backend WeChat miniapp payment-create client.
- Replaced the placeholder body in `createMiniappPayment(...)` with a real WeChat payment-create call while keeping customer ownership and `PENDING_PAYMENT` checks unchanged.
- Froze the real initiation response shape to:
  - `provider: 'wechat'`
  - `initiationType: 'MINIAPP'`
  - `orderId`
  - `orderNo`
  - `totalAmountCents`
  - `launchParams`
- Added focused tests for the workflow path and the new payment-create client seam.

## B. what was intentionally not implemented

- No callback verification or callback completion changes.
- No refunds.
- No reconciliation.
- No admin payment tooling.
- No multi-provider abstraction.
- No miniapp `requestPayment` execution yet.

## C. how to verify

- Run `npx jest --runInBand test/order-workflow.service.smoke.spec.ts test/orders.controller.spec.ts test/wechat-miniapp-payment-create.client.spec.ts` in `apps/api`.
- Run `npx tsc -p apps/api/tsconfig.json --noEmit` from the repo root.
- Run `npm run build:weapp` in `apps/storefront-miniapp`.
- Confirm `POST /orders/:id/create-miniapp-payment` now returns real WeChat-style `launchParams` instead of the old placeholder body.

## D. phase conclusion

Phase 7B lands the first real miniapp payment-initiation backend client seam and returns a real launch payload without changing callback completion or expanding payment scope.
