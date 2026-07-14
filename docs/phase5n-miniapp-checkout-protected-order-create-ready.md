# Phase 5N Miniapp Checkout Protected Order Create Ready

## A. What was added

- Miniapp checkout submit path now uses protected `POST /orders/authenticated` when the current miniapp identity source is `real-storage`
- Miniapp checkout now fails clearly if the protected checkout path is selected but the stored `authArtifact` is missing
- Non-migrated callers, including web checkout and non-real-auth miniapp paths, still keep using the shared `POST /orders`

## B. What was intentionally not implemented

- No payment
- No web checkout migration
- No broad order-route migration
- No global header-trust removal
- No admin or staff auth
- No README changes

## C. How to verify

- Run `npm run build:weapp -w @seafood/storefront-miniapp`
- Open miniapp real-auth flow and confirm:
  - valid stored `authArtifact` lets checkout create an order through the protected seam
  - missing `authArtifact` on the protected checkout path fails honestly
  - the created order remains readable through the protected order read seam

## D. Phase conclusion

Phase 5N moves the real miniapp checkout submit path onto backend-verified order creation when real auth state is active, without migrating web checkout, payment, or the rest of the order domain.
