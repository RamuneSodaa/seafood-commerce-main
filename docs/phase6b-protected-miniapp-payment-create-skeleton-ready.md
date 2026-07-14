# Phase 6B Protected Miniapp Payment Create Skeleton Ready

## A. What was added

- Added one protected backend payment-create skeleton route at `POST /orders/:id/create-miniapp-payment`
- Added one workflow skeleton that derives customer scope from the verified auth artifact, validates order access, and only allows `PENDING_PAYMENT`
- Added one minimal not-implemented miniapp payment-initiation response shape without calling real provider APIs or `markPaid`

## B. What was intentionally not implemented

- No real provider initiation
- No callback verification
- No payment completion logic
- No `markPaid` redesign
- No frontend adoption
- No README changes

## C. How to verify

- Run `npm run test -w @seafood/api -- orders.controller.spec.ts`
- Run `npm run test -w @seafood/api -- order-workflow.service.smoke.spec.ts`
- Run `npx tsc -p apps/api/tsconfig.json --noEmit`

## D. Phase conclusion

Phase 6B lands the first protected backend miniapp payment-create seam as a non-mutating skeleton, so future provider initiation can start from backend-verified customer order scope without yet performing real payment work.
