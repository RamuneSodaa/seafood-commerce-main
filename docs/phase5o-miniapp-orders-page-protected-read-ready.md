# Phase 5O Miniapp Orders Page Protected Read Ready

## A. What was added

- Miniapp orders page now uses protected `GET /orders/authenticated` when the current miniapp identity source is `real-storage`
- Miniapp orders page now fails clearly if the protected read path is selected but the stored `authArtifact` is missing
- Non-real-auth miniapp paths still keep using the shared `GET /orders`

## B. What was intentionally not implemented

- No payment
- No web orders-page migration
- No order-detail migration
- No global header-trust removal
- No admin or staff auth
- No README changes

## C. How to verify

- Run `npm run build:weapp -w @seafood/storefront-miniapp`
- Open miniapp real-auth flow and confirm:
  - valid stored `authArtifact` lets the orders page load through the protected seam
  - missing or invalid `authArtifact` on the protected orders-page path fails honestly
  - a protected checkout-created order is visible on the protected orders page

## D. Phase conclusion

Phase 5O moves the real miniapp orders-page read path onto backend-verified order reading when real auth state is active, without migrating web orders, order detail, payment, or the rest of the order domain.
