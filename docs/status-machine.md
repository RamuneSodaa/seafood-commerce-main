# Status Machine (Phase 1)

## STORE_PICKUP
`PENDING_PAYMENT -> PAID_PENDING_PREP -> READY_FOR_PICKUP -> COMPLETED`

## SHIPPING
`PENDING_PAYMENT -> PAID_PENDING_SHIPMENT -> SHIPPED -> DELIVERED`

## Cancel
- allowed in: `PENDING_PAYMENT`, `PAID_PENDING_PREP`, `PAID_PENDING_SHIPMENT`, `READY_FOR_PICKUP`
- result: `CANCELLED`

## Inventory Timing
- reserve stock: on payment mark success
- rollback reservation: on cancel before fulfillment boundary
- deduct physical stock: on pickup complete or shipment marked

## Phase 1 Fulfillment Store Rule
- every order binds to exactly one fulfillment `storeId`
- SHIPPING in Phase 1 ships from that single selected fulfillment store
- multi-store split fulfillment is out of Phase 1 scope
