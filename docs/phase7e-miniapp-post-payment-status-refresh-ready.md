## A. what was added

- Kept the immediate order-detail refresh after successful payment launch.
- Added one short bounded polling loop in the miniapp order-detail pay success path that continues only while order status is still `PENDING_PAYMENT`.
- Stopped polling immediately once status leaves `PENDING_PAYMENT`.
- Added one honest fallback message when bounded polling ends and backend confirmation is still not visible.

## B. what was intentionally not implemented

- No backend callback or completion changes.
- No refunds.
- No reconciliation.
- No web payment work.
- No broader payment-state redesign.

## C. how to verify

- Run `npx tsc -p apps/storefront-miniapp/tsconfig.json --noEmit` from the repo root.
- Run `npm run build:weapp` in `apps/storefront-miniapp`.
- In the miniapp pay success path, confirm the page now does:
  - one immediate refresh
  - one short bounded polling loop while status remains `PENDING_PAYMENT`
  - immediate stop when status changes
  - honest fallback feedback if status does not change in time

## D. phase conclusion

Phase 7E minimally closes the miniapp post-payment refresh gap without changing backend callback/completion behavior or broadening payment scope.
