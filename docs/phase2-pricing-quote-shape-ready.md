# Phase 2 Pricing Quote Shape Ready

## 1. What was added

The internal `OrderPricingService.quoteListPrice()` return shape was expanded from:
- `totalAmountCents`
- `lines`

to:
- `subtotalAmountCents`
- `discountAmountCents`
- `totalAmountCents`
- `lines`
- `adjustments`

This change only aligns the internal pricing quote shape toward the future pricing contract direction.

## 2. What was intentionally not changed

This stage did not change:
- schema
- API contract
- frontend contract
- checkout request shape
- payment logic
- inventory reservation
- fulfillment state machine
- coupon / promotion / points / referral implementation

`createOrder()` external behavior also remains unchanged.

## 3. Current quote shape semantics

The newly added fields are internal pricing quote shape only. They are not API contract and not frontend contract.

Current semantics remain:
- `discountAmountCents = 0`
- `adjustments = []`
- `totalAmountCents = subtotalAmountCents`
- `lineTotalCents = unitPriceCents * quantity`

This stage does not implement any real discount or adjustment logic.

## 4. How to verify

Use:
- API tests
- pricing unit tests

Verification should confirm that order creation result and downstream behavior remain unchanged.

## 5. Current phase conclusion

The pricing internal quote shape is now aligned one step closer to the future contract direction, while keeping the current order creation main flow result unchanged.
