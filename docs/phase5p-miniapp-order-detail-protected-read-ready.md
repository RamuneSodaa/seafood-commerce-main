# Phase 5P Miniapp Order Detail Protected Read Ready

## A. What was added

- Added one parallel protected order-detail seam at `GET /orders/:id/authenticated`
- Miniapp order-detail page now uses the protected detail seam when the current miniapp identity source is `real-storage`
- Miniapp order-detail page now fails clearly if the protected detail path is selected but the stored `authArtifact` is missing

## B. What was intentionally not implemented

- No payment changes
- No web order-detail migration
- No order status transition migration
- No broader order-route migration
- No global header-trust removal
- No README changes

## C. How to verify

- Run `npm run test -w @seafood/api -- orders.controller.spec.ts`
- Run `npm run build:weapp -w @seafood/storefront-miniapp`
- Open miniapp real-auth flow and confirm:
  - valid stored `authArtifact` lets order detail load through the protected seam
  - missing or invalid `authArtifact` on the protected detail path fails honestly
  - a protected checkout-created order can be opened from the protected orders list into protected detail

## D. Phase conclusion

Phase 5P moves the real miniapp order-detail read path onto backend-verified customer identity by adding one parallel protected detail seam, without migrating web order detail, payment, status transitions, or the rest of the order domain.
