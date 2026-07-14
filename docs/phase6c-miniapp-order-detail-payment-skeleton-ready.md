# Phase 6C Miniapp Order Detail Payment Skeleton Ready

## A. What was added

- Miniapp payment transition now calls protected `POST /orders/:id/create-miniapp-payment` when the current miniapp identity source is `real-storage`
- Miniapp order detail now surfaces the returned payment skeleton honestly as a not-implemented payment result
- Added one miniapp API helper for the protected payment-create skeleton route

## B. What was intentionally not implemented

- No real provider initiation
- No callback verification
- No payment completion logic
- No order status mutation from the skeleton path
- No web payment migration
- No README changes

## C. How to verify

- Run `npm run build:weapp -w @seafood/storefront-miniapp`
- Open miniapp real-auth order detail and confirm:
  - valid stored `authArtifact` lets the pay button reach the protected payment-create skeleton
  - missing or invalid `authArtifact` on the protected payment path fails honestly
  - returned skeleton payload is shown honestly and does not mark the order paid

## D. Phase conclusion

Phase 6C adopts the protected backend miniapp payment-create skeleton in the real miniapp order-detail pay path, without initiating real provider payment, handling callbacks, or marking orders paid.
