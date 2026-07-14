# Frontend Handoff (Phase 1)

## 1) Storefront pages -> endpoints

### Catalog list page
- `GET /products`
- headers: `x-role: CUSTOMER`, `x-user-id`

### Product detail page
- `GET /products/:id`
- headers: `x-role: CUSTOMER`, `x-user-id`

### Checkout page
- `POST /orders`
- headers: `x-role: CUSTOMER`, `x-user-id`
- payload: `storeId`, `fulfillmentType`, `items`, plus pickup/shipping snapshot fields

### Payment callback page action
- `POST /orders/:id/mark-paid`
- headers: `x-role: CUSTOMER`, `x-user-id`

### Order detail page
- `GET /orders/:id`
- headers: `x-role: CUSTOMER`, `x-user-id`

### Order cancellation action
- `POST /orders/:id/cancel`
- headers: `x-role: CUSTOMER`, `x-user-id`

## 2) Admin pages -> endpoints

### Product management
- `GET /admin/products`
- `POST /admin/products`
- `PATCH /admin/products/:id`
- `POST /admin/products/:id/publish`

### Store management
- `GET /admin/stores`
- `POST /admin/stores`
- `PATCH /admin/stores/:id`

### Inventory management
- `GET /admin/inventory`
- `POST /admin/inventory/adjust`

## 3) Store workbench pages -> endpoints

- pickup prep: `POST /orders/:id/ready-for-pickup`
- pickup complete: `POST /orders/:id/complete-pickup`
- shipment create/ship: `POST /orders/:id/ship`
- delivered: `POST /orders/:id/deliver`
- support query: `GET /orders`, `GET /orders/:id`, `GET /orders/:id/status-logs`

## 4) Shared integration rules

- all requests include `x-role`
- customer/admin/store role must match endpoint role guard
- error shape is normalized by global filter
