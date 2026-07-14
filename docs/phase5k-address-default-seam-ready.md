# Phase 5K Address Default Seam Ready

## A. What was added

- Preserved the original shared `POST /customer/addresses/:id/set-default` behavior for existing header-based callers
- Added one parallel protected seam at `POST /customer/addresses/:id/set-default/authenticated` that derives customer identity from the verified auth artifact
- Miniapp real-auth dev page now includes one minimal authenticated default-address verification path using the stored `authArtifact`

## B. What was intentionally not implemented

- No payment
- No orders migration
- No global header-trust removal
- No admin or staff auth
- No placeholder flow change

## C. How to verify

- Run `npm run test -w @seafood/api -- customer-addresses-auth-route.spec.ts`
- Run `npm run test -w @seafood/api -- auth-customer-artifact.spec.ts`
- Run `npx tsc -p apps/api/tsconfig.json --noEmit`
- Run `npm run build:weapp -w @seafood/storefront-miniapp`
- Open `pages/dev-auth-real-entry/index` and confirm:
  - valid `authArtifact` makes `POST /customer/addresses/:id/set-default/authenticated` succeed
  - missing `authArtifact` makes the protected default seam fail honestly
  - tampered `authArtifact` makes the protected default seam fail honestly
  - default-address change uses backend-verified customer identity

## D. Phase conclusion

Phase 5K adds one protected default-address seam beside the original shared set-default route, so the customer address domain now has backend-verified read, create, and default-setting seams without migrating orders, payment, or global header trust.
