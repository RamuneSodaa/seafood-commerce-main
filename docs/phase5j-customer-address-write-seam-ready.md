# Phase 5J Customer Address Write Seam Ready

## A. What was added

- Preserved the original shared `POST /customer/addresses` behavior for existing header-based callers
- Added one parallel protected write seam at `POST /customer/addresses/authenticated` that derives customer identity from the verified auth artifact
- Miniapp real-auth dev page now includes one minimal authenticated address-create verification path using the stored `authArtifact`

## B. What was intentionally not implemented

- No payment
- No orders migration
- No `POST /customer/addresses/:id/set-default` migration
- No global header-trust removal
- No admin or staff auth

## C. How to verify

- Run `npm run test -w @seafood/api -- customer-addresses-auth-route.spec.ts`
- Run `npm run test -w @seafood/api -- auth-customer-artifact.spec.ts`
- Run `npx tsc -p apps/api/tsconfig.json --noEmit`
- Run `npm run build:weapp -w @seafood/storefront-miniapp`
- Open `pages/dev-auth-real-entry/index` and confirm:
  - valid `authArtifact` makes `POST /customer/addresses/authenticated` succeed
  - missing `authArtifact` makes the protected write seam fail honestly
  - tampered `authArtifact` makes the protected write seam fail honestly
  - created address uses backend-verified customer identity

## D. Phase conclusion

Phase 5J adds one protected customer address write seam beside the original shared create route, so customer-authenticated address creation can be proven without migrating orders, payment, or all customer write paths.
