# Phase 2 Pricing Service List Price Ready

## 1. What changed

`createOrder()` now routes order amount calculation through `OrderPricingService.quoteListPrice()`. The current pricing layer only computes list price using SKU unit price and quantity, while keeping the same order total result and line unit price result as before.

## 2. What did not change

This stage did not change:
- schema
- API contract
- storefront or miniapp pages
- payment flow
- inventory reservation
- fulfillment state machine
- coupon / promotion implementation

## 3. How to verify the result did not change

Use:
- API tests
- pricing unit test

The API suite confirms existing order creation and downstream flow still behave the same. The pricing unit test confirms list-price calculation still matches the previous formula.

## 4. Current phase conclusion

The pricing extension point is now coded into the backend. Future coupon or promotion work must extend this pricing layer, instead of scattering final price calculation into clients or unrelated order logic.
