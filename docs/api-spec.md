# Phase 1 API (Wired Backend)

Base URL (local): `http://localhost:3000`

## Common headers

- `x-role: ADMIN | STORE | CUSTOMER`
- `x-user-id: <string>` (required for customer create-order and recommended for all requests)
- `content-type: application/json`

## Normalized error shape

```json
{
  "success": false,
  "error": {
    "code": 400,
    "message": "validation or business error message",
    "details": {},
    "path": "/orders",
    "timestamp": "2026-04-07T00:00:00.000Z"
  }
}
```

## Customer storefront endpoints

### GET /products
Response example:

```json
[
  {
    "id": "prod_1",
    "name": "Fresh Salmon",
    "description": "Phase 1 seed product",
    "supportsPickup": true,
    "supportsShipping": true,
    "skus": [
      { "id": "sku_1", "code": "SALMON-500G", "name": "Salmon 500g", "priceCents": 5800 }
    ]
  }
]
```

### GET /products/:id
Response is one published product detail with same shape as list item.

### GET /stores
Response: active store list for storefront checkout selector (`id`, `name`, `address`).

### POST /orders
Request example (STORE_PICKUP):

```json
{
  "storeId": "store_1",
  "fulfillmentType": "STORE_PICKUP",
  "pickupDate": "2026-04-08T00:00:00.000Z",
  "pickupTimeSlot": "10:00-12:00",
  "items": [{ "skuId": "sku_1", "quantity": 1 }]
}
```

Request example (SHIPPING):

```json
{
  "storeId": "store_1",
  "fulfillmentType": "SHIPPING",
  "items": [{ "skuId": "sku_2", "quantity": 1 }],
  "shippingAddress": {
    "receiverName": "Alice",
    "phone": "13100000000",
    "province": "Shanghai",
    "city": "Shanghai",
    "district": "Pudong",
    "detail": "Road 1",
    "postalCode": "200000"
  }
}
```

Response example:

```json
{
  "id": "order_1",
  "orderNo": "SO-1710000000000",
  "status": "PENDING_PAYMENT",
  "totalAmountCents": 5800,
  "fulfillmentType": "STORE_PICKUP",
  "pickupCode": "123456"
}
```

### POST /orders/:id/mark-paid
```json
{ "paymentRef": "wxpay-20260407-001", "paidAmountCents": 5800 }
```
Response:
```json
{ "result": "APPLIED" }
```

### POST /orders/:id/cancel
Response:
```json
{ "result": "CANCELLED" }
```

### GET /orders/:id
Response: order detail with items and fulfillment snapshot.

## Admin endpoints

- `GET /admin/products`
- `POST /admin/products`
- `PATCH /admin/products/:id`
- `POST /admin/products/:id/publish`
- `GET /admin/stores`
- `POST /admin/stores`
- `PATCH /admin/stores/:id`
- `GET /admin/inventory`
- `POST /admin/inventory/adjust`

## Store workbench endpoints

- `GET /orders`
- `GET /orders/:id`
- `GET /orders/:id/status-logs`
- `POST /orders/:id/ready-for-pickup`
- `POST /orders/:id/complete-pickup`
- `POST /orders/:id/ship`
- `POST /orders/:id/deliver`
