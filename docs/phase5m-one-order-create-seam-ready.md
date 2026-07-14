# Phase 5M One Order Create Seam Ready

## A. What was added

- Preserved the original shared `POST /orders` behavior for existing header-based callers
- Added one parallel protected order-create seam at `POST /orders/authenticated` that derives customer identity from the verified auth artifact
- Miniapp real-auth dev page now includes one minimal authenticated order-create verification path using the stored `authArtifact`

## B. What was intentionally not implemented

- No payment
- No payment callback work
- No broad order-route migration
- No global header-trust removal
- No admin or staff auth
- No placeholder flow change

## C. How to verify

- Run `npm run test -w @seafood/api -- orders.controller.spec.ts`
- Run `npm run test -w @seafood/api -- auth-customer-artifact.spec.ts`
- Run `npx tsc -p apps/api/tsconfig.json --noEmit`
- Run `npm run build:weapp -w @seafood/storefront-miniapp`
- Open `pages/dev-auth-real-entry/index` and confirm:
  - valid `authArtifact` makes `POST /orders/authenticated` succeed
  - missing `authArtifact` makes the protected order-create seam fail honestly
  - tampered `authArtifact` makes the protected order-create seam fail honestly
  - protected order creation uses backend-verified customer identity

## D. Phase conclusion

Phase 5M adds one protected order-create seam beside the original shared order-create route, so backend-verified customer identity can now be proven on the first order write path without migrating payment or the rest of the order domain.
