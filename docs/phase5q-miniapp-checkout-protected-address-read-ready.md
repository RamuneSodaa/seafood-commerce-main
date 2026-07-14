# Phase 5Q Miniapp Checkout Protected Address Read Ready

## A. What was added

- Miniapp checkout now uses protected `GET /customer/addresses/authenticated` when the current miniapp identity source is `real-storage`
- Miniapp checkout now fails clearly if the protected address-read path is selected but the stored `authArtifact` is missing
- Non-real-auth miniapp paths still keep using the shared `GET /customer/addresses`

## B. What was intentionally not implemented

- No payment
- No web checkout migration
- No broader address-route migration
- No checkout submit-path redesign
- No global header-trust removal
- No README changes

## C. How to verify

- Run `npm run build:weapp -w @seafood/storefront-miniapp`
- Open miniapp real-auth flow and confirm:
  - valid stored `authArtifact` lets checkout load default address through the protected seam
  - missing or invalid `authArtifact` on the protected checkout path fails honestly
  - protected address autofill still works with the protected order-create submit path

## D. Phase conclusion

Phase 5Q moves the real miniapp checkout address-read path onto backend-verified customer identity when real auth state is active, without changing web checkout, payment, or the broader address domain.
