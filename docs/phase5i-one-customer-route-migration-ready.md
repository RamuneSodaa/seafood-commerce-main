# Phase 5I One Customer Route Migration Ready

## A. What was added

- Preserved the original shared `GET /customer/addresses` behavior for existing header-based callers
- Added one parallel protected seam at `GET /customer/addresses/authenticated` that uses backend-verified customer identity from the signed auth artifact
- Miniapp real-auth dev page now proves the first real customer business-route call through this protected parallel address seam

## B. What was intentionally not implemented

- No payment
- No broad orders migration
- No full header-trust removal everywhere
- No session or refresh-token platform
- No admin or staff auth
- No placeholder flow change

## C. How to verify

- Run `npm run test -w @seafood/api -- customer-addresses-auth-route.spec.ts`
- Run `npm run test -w @seafood/api -- auth-customer-artifact.spec.ts`
- Run `npm run build:weapp -w @seafood/storefront-miniapp`
- Open miniapp dev page `pages/dev-auth-real-entry/index` and confirm:
  - valid `authArtifact` makes `GET /customer/addresses/authenticated` succeed
  - missing `authArtifact` makes the protected seam fail honestly
  - tampered `authArtifact` makes the protected seam fail honestly
  - the old shared `GET /customer/addresses` path remains available for legacy callers

## D. Phase conclusion

Phase 5I only adds one real customer business-route migration seam beside the original shared addresses route. It proves backend-verified customer auth on a real business path without migrating orders or all customer routes yet.
