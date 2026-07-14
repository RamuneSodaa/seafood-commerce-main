# Phase 5K Order Auth Migration Boundary Ready

## A. Current state

- Orders currently trust customer identity from `x-role` and `x-user-id` in `apps/api/src/modules/orders/orders.controller.ts`
- Customer-scoped order seams that are still header-based:
  - `POST /orders`
  - `GET /orders`
  - `GET /orders/:id`
  - `POST /orders/:id/mark-paid`
  - `POST /orders/:id/cancel`
- `POST /orders` is the highest-risk customer seam because it writes a real order, computes pricing, writes status log, and branches into pickup or shipping data shape
- `GET /orders` is a lower-risk read seam because it only scopes list results by customer identity
- `GET /orders/:id` is still read-only, but it also applies per-order access control and exposes the full order detail shape
- `POST /orders/:id/mark-paid` is highly sensitive because it writes payment record, locks inventory, reserves stock, and changes order status
- `POST /orders/:id/cancel` is highly sensitive because it may roll back reserved inventory and changes order status
- `POST /orders/quote-preview` does not currently use customer identity and is not the first order-auth migration target
- Admin / store fulfillment routes (`ready-for-pickup`, `complete-pickup`, `ship`, `deliver`, `status-logs`) are not customer-auth migration targets in this phase
- Current web and miniapp order call paths still go through the legacy header-based order routes for checkout, order list, order detail, pay, and cancel

## B. Why order auth migration must be done carefully

- Order seams are more sensitive than address seams because they sit on the core commerce path
- Order create already touches pricing validation, order persistence, status-log creation, and fulfillment-shape branching
- Payment and cancel seams directly touch inventory reservation or rollback and order state transitions
- A bad first migration on the order chain can break sellable checkout, payment preparation, inventory correctness, or fulfillment progression

## C. Smallest safe migration target

- The smallest safe next seam is a parallel protected `GET /orders/authenticated`
- This is safer than `POST /orders/authenticated` because it is read-only, does not mutate pricing, inventory, payment, or fulfillment state, and can prove backend-verified customer scoping on the order chain first
- It is also narrower than migrating `GET /orders/:id` first, because list scoping only depends on authenticated customer identity and does not add per-order detail access complexity
- Keeping it parallel avoids breaking existing shared `/orders` callers in web and miniapp while proving the first backend-verified order path

## D. Explicitly out of scope

- No payment implementation
- No broad order-route migration
- No global header-trust removal
- No fulfillment redesign
- No admin or staff auth
- No README changes

## E. Single smallest next code task

- Add one parallel protected `GET /orders/authenticated` route that uses `CustomerAuthArtifactGuard`, derives the customer identity from `req.authenticatedCustomer.userId`, forwards that identity into the existing order list scope, and updates only one miniapp real-auth proof path to call this protected order-list seam
