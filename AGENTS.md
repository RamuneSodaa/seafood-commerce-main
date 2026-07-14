# AGENTS.md

## Project
This project is a seafood retail commerce system with:
- WeChat Mini Program storefront
- merchant/admin backend
- store operation flow

The business goal is:
customers can browse products online, place orders, choose either store pickup or shipping, and the company can manage products, inventory, stores, fulfillment, and orders.

## Core flows
1. Merchant uploads products to backend
2. Products are shown in the storefront
3. Customer places order
4. Customer selects fulfillment type:
   - STORE_PICKUP
   - SHIPPING
5. Customer pays
6. System reserves inventory
7. If STORE_PICKUP:
   - store prepares order
   - order becomes ready for pickup
   - customer picks up using pickup code
   - physical inventory is deducted
8. If SHIPPING:
   - merchant ships order
   - logistics info is recorded
   - physical inventory is deducted on shipment

## Roles
- Customer
- Store staff
- Store manager
- Admin / merchant operator

## Tech stack
Use this stack unless there is a strong reason not to:
- Frontend web admin: Next.js + TypeScript + Tailwind
- Backend API: NestJS + TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Tests: Jest

## Phase 1 scope
Build only the core commerce loop first:
- product management
- SKU support
- store support
- inventory support
- order creation
- payment-marked flow
- reserve inventory
- store pickup flow
- shipping flow
- cancel order and inventory rollback
- order status log
- inventory log
- basic admin pages
- basic storefront pages

## Out of scope for phase 1
Do NOT build yet:
- distribution / reseller system
- points mall
- advanced membership system
- coupons
- group buying
- live commerce
- complex promotion engine
- advanced BI dashboards

## Key business rules
- Inventory must support store-specific stock
- Each product may have multiple SKUs
- Customer must choose fulfillment type during checkout
- Payment success reserves stock
- Cancelling before pickup/shipping releases reserved stock
- Store pickup requires pickup code verification
- Shipping requires address and shipment record
- Every inventory change must create InventoryLog
- Every order status change must create OrderStatusLog
- Prevent negative stock

## Inventory fields
At minimum support:
- physicalStock
- availableStock
- reservedStock
- damagedStock
- safeStock

## Minimum order statuses
- PENDING_PAYMENT
- PAID_PENDING_PREP
- READY_FOR_PICKUP
- COMPLETED
- PAID_PENDING_SHIPMENT
- SHIPPED
- DELIVERED
- CANCELLED
- AFTER_SALES

## Engineering rules
- Use clear English naming
- Keep comments simple and useful
- Do not fake completion
- Mark unfinished parts with TODO
- Keep business logic out of UI where possible
- Keep services modular and extensible
- Add seed data for local dev
- Add tests for critical flows

## Done means
- local project runs
- migrations run
- seed works
- APIs work
- critical tests pass
- README has setup steps
