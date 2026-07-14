# Phase 1 Product Min Edit Ready

## 1. What was added

This stage completes the minimal product edit loop under the current single-SKU product model.

Admin can now edit:
- product name
- description
- `coverImageUrl`
- `supportsPickup`
- `supportsShipping`
- `defaultSkuName`
- `defaultPriceCents`

This is the smallest safe extension on top of the existing single-SKU sellable product creation flow.

## 2. What was intentionally not changed

This stage did not introduce:
- multi-SKU editing
- SKU code editing
- initial stock editing
- image upload system
- coupon / points / promotion
- real login
- real payment

It also did not change the current single-SKU creation structure, checkout contract, or fulfillment flow.

## 3. Safety boundaries

- At least one fulfillment mode must remain enabled. `supportsPickup` and `supportsShipping` cannot both be `false`.
- Default SKU name and default SKU price are editable only when `SKU count === 1`.
- Historical multi-SKU products are safely rejected in this stage and will not mutate any arbitrary SKU.

## 4. How to verify

Use:
- `docs/phase1-product-smoke-checklist.md`

The smoke checklist is the minimum regression and acceptance baseline for this frozen product stage.

## 5. Current phase conclusion

Phase 1 product operations are now frozen at the “single-SKU sellable product + minimal product edit” level.
