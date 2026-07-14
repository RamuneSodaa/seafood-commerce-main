# Phase 5L One Order Read Seam Ready

## A. What was added

- Preserved the original shared `GET /orders` behavior for existing header-based callers
- Added one parallel protected order read seam at `GET /orders/authenticated` that derives customer identity from the verified auth artifact
- Miniapp real-auth dev page now includes one minimal authenticated order-list verification path using the stored `authArtifact`

## B. What was intentionally not implemented

- No payment
- No order-create migration
- No global header-trust removal
- No admin or staff auth
- No placeholder flow change

## C. How to verify

- Run `npm run test -w @seafood/api -- orders.controller.spec.ts`
- Run `npm run test -w @seafood/api -- auth-customer-artifact.spec.ts`
- Run `npx tsc -p apps/api/tsconfig.json --noEmit`
- Run `npm run build:weapp -w @seafood/storefront-miniapp`
- Open `pages/dev-auth-real-entry/index` and confirm:
  - valid `authArtifact` makes `GET /orders/authenticated` succeed
  - missing `authArtifact` makes the protected order read seam fail honestly
  - tampered `authArtifact` makes the protected order read seam fail honestly
  - protected order list uses backend-verified customer identity

## D. Phase conclusion

Phase 5L adds one protected order read seam beside the original shared order-list route, so the order domain now has its first backend-verified customer read path without touching order creation, payment, or broader order-route migration.
