# Manual E2E Verification Script (Phase 1)

## Preconditions

1. Run migration SQL.
2. Run seed: `npm run seed -w @seafood/api`.
3. Start API: `npm run start -w @seafood/api`.

## A) Browse catalog

1. `GET /products` with headers `x-role: CUSTOMER`, `x-user-id: demo-customer`.
2. Choose one SKU id.

## B) Create pickup order

1. `POST /orders` with `fulfillmentType=STORE_PICKUP` and pickup fields.
2. Verify response returns `PENDING_PAYMENT` and `pickupCode`.

## C) Mark paid (reserve stock)

1. `POST /orders/:id/mark-paid` with unique paymentRef.
2. Verify order status transitions to `PAID_PENDING_PREP` for pickup.

## D1) Cancel rollback path

1. `POST /orders/:id/cancel`.
2. Verify response `CANCELLED` and order detail reflects cancel.

## D2) Fulfillment path (instead of cancel)

1. `POST /orders/:id/ready-for-pickup` as STORE role.
2. `POST /orders/:id/complete-pickup` with pickupCode.
3. Verify final status `COMPLETED`.

## E) Shipping path

1. Create another order with `fulfillmentType=SHIPPING` and shippingAddress.
2. Mark paid.
3. `POST /orders/:id/ship` with courier + tracking.
4. `POST /orders/:id/deliver`.
5. Verify final status `DELIVERED`.
