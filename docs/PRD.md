# Seafood Commerce System PRD

## 1. System definition
This is a commerce system connected to a WeChat Mini Program storefront.

It supports:
- online product browsing
- cart and checkout
- store pickup
- shipping
- merchant backend operations
- store operations
- inventory and order management

## 2. Core business goal
After products are published to the online store, customers can buy directly from the storefront and choose either:
- pickup at a physical store
- shipping by courier

## 3. Roles
### Customer
- browse products
- add to cart
- place order
- choose pickup or shipping
- pay
- check order status

### Merchant admin
- create and edit products
- manage SKUs
- manage stores
- manage orders
- manage inventory
- process refunds / after-sales

### Store staff
- view pickup orders
- prepare pickup orders
- verify pickup code
- mark orders as picked up
- process store-side exceptions

## 4. Core modules
### Product module
- product CRUD
- category management
- SKU management
- price
- stock
- images
- description
- whether pickup is supported
- whether shipping is supported

### Store module
- multiple stores
- store address
- store contact info
- pickup time slots
- store-specific product availability

### Checkout module
- cart
- order creation
- fulfillment type selection
- pickup slot selection
- shipping address

### Order module
- order list
- order detail
- order status transitions
- cancellation
- after-sales

### Inventory module
- stock query
- stock reservation
- stock rollback
- stock deduction
- inventory log

### Pickup module
- pickup code generation
- pickup verification
- pickup record

### Shipping module
- address
- shipment record
- courier company
- tracking number

## 5. Fulfillment types
### STORE_PICKUP
Customer selects:
- store
- pickup date
- pickup time slot

Flow:
order -> paid -> reserved -> preparing -> ready for pickup -> picked up -> completed

### SHIPPING
Customer selects:
- shipping address

Flow:
order -> paid -> reserved -> pending shipment -> shipped -> delivered

## 6. Phase 1 priorities
P0:
- product + SKU
- store
- inventory
- create order
- choose pickup or shipping
- reserve stock
- cancel and rollback
- pickup verification
- shipping record
- admin order list
- admin inventory list

P1:
- better storefront pages
- notifications
- store operation dashboard
- basic reports

P2:
- membership
- coupons
- marketing
- advanced reports
- distribution system
