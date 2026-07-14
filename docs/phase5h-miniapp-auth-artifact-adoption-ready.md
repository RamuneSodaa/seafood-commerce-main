# Phase 5H Miniapp Auth Artifact Adoption Ready

## A. What was added

- Miniapp real-auth dev entry now stores the backend-issued `authArtifact` after successful `/auth/exchange-real`
- Miniapp request helper now supports sending `Authorization: Bearer <authArtifact>` for one narrow authenticated call
- Miniapp dev flow now reuses `GET /auth/verify-customer-artifact` to prove backend-verified authenticated customer identity

## B. What was intentionally not implemented

- No payment
- No broad customer-route migration
- No removal of existing `x-user-id` / `x-role` path everywhere
- No refresh-token or expiry platform
- No admin or staff auth
- No placeholder flow change

## C. How to verify

- Run `npm run build:weapp -w @seafood/storefront-miniapp`
- Open miniapp dev page `pages/dev-auth-real-entry/index`
- Trigger real auth success and confirm:
  - `authArtifact` is returned and stored
  - backend verification succeeds through `/auth/verify-customer-artifact`
  - page shows both local resolved identity and backend verified identity
- Then confirm failure paths:
  - clear stored `authArtifact` and run verification to see missing-artifact failure
  - run tampered-artifact verification to see backend rejection

## D. Phase conclusion

Phase 5H only proves one end-to-end miniapp adoption of the signed customer auth artifact plus one protected verification seam. It does not migrate all customer routes yet.
