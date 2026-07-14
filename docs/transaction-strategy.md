# Phase 1 Transaction Strategy

All critical workflow mutations are wrapped in a single Prisma transaction (`prisma.$transaction`) at service entry.

## Transactional operations

- `markPaid`
  - idempotency check by `paymentRef`
  - create `PaymentRecord` (durable key)
  - inventory reserve mutation for all items
  - status transition + `OrderStatusLog`
  - `InventoryLog` entries

- `cancelOrder`
  - precheck all items before rollback mutation
  - rollback reserved->available
  - status transition + logs

- `completePickup`
  - pickup code verification + duplicate pickup guard
  - full precheck reserved/physical for all items
  - deduct reserved/physical
  - pickup record completion timestamp
  - status transition + logs

- `shipOrder`
  - full precheck reserved/physical for all items
  - deduct reserved/physical
  - shipment create/upsert
  - status transition + logs

- `markDelivered`
  - shipment delivered timestamp
  - status transition + logs

## All-or-nothing rule

Every operation above performs validation first, then writes all mutations/logs in one transaction to avoid partial updates.
