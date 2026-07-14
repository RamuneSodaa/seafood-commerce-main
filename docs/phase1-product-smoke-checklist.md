# Phase 1 Product Smoke Checklist

## Purpose
This checklist is the minimum regression baseline for the current "sellable single-SKU product" flow.

Use it after changes related to:
- products
- product admin pages
- checkout
- order creation
- inventory
- fulfillment
- storefront-web
- storefront-miniapp
- products API

---

## Success cases

### 1. Admin creates a sellable single-SKU product
Steps:
- Open `admin-web` product page.
- Fill the minimal create form:
  - product name
  - description
  - `coverImageUrl`
  - `supportsPickup`
  - `supportsShipping`
  - default SKU name
  - default SKU code (optional)
  - default SKU price
  - initial store
  - `initialStock`
- Click **Create sellable product**.

Expected:
- Product is created successfully.
- Backend auto-creates exactly 1 default SKU.
- Inventory is initialized as:
  - `physicalStock = initialStock`
  - `availableStock = initialStock`
  - `reservedStock = 0`
- If default SKU code is empty, backend auto-generates a unique code.
- Product appears in admin list.

---

### 2. Admin edits a single-SKU product
Steps:
- Select the product in admin product list.
- Update:
  - product name
  - description
  - `coverImageUrl`
  - `supportsPickup`
  - `supportsShipping`
  - default SKU name
  - default SKU price
- Click **Save product edits**.

Expected:
- Product fields update successfully.
- For single-SKU product, default SKU name and price update successfully.
- Product list, side panel, and price display refresh correctly.

---

### 3. Publish product
Steps:
- Click **Publish product** in admin side panel.

Expected:
- Publish succeeds.
- Product becomes visible in customer-facing channels.
- No missing SKU / missing inventory / missing availability errors.

---

### 4. Storefront web browse
Steps:
- Open storefront product list.
- Open product detail page.

Expected:
- Product is visible in list.
- If `coverImageUrl` exists, image is displayed.
- Product detail shows:
  - correct name
  - description
  - SKU name
  - price
  - fulfillment support

---

### 5. Storefront web checkout
Steps:
- Enter checkout from product detail.
- Verify both:
  - `SHIPPING`
  - `STORE_PICKUP`
- Create order.

Expected:
- `SHIPPING` flow accepts address and creates order.
- `STORE_PICKUP` flow accepts store selection and creates order.
- Order enters `PENDING_PAYMENT`.

---

### 6. Miniapp browse
Steps:
- Open miniapp product list.
- Open miniapp product detail.

Expected:
- Product information matches storefront web.
- Image, SKU, price, and fulfillment support display correctly.

---

### 7. Miniapp checkout
Steps:
- Enter checkout from miniapp product detail.
- Verify both:
  - `SHIPPING`
  - `STORE_PICKUP`
- Create order.

Expected:
- Both flows create order successfully.
- Order appears in miniapp order list / detail entry.

---

### 8. Shipping fulfillment flow
Steps:
- Create a `SHIPPING` order from customer side.
- Complete mock payment.
- Open order detail in `admin/store`.
- Fill courier company and tracking number.
- Mark as shipped.
- Then mark as delivered.

Expected:
- After payment, order enters shipping-ready state.
- After shipping, order becomes `SHIPPED`.
- After delivery, order becomes `DELIVERED`.
- Courier, tracking number, and shipped timestamp are visible.

---

### 9. Store pickup fulfillment flow
Steps:
- Create a `STORE_PICKUP` order from customer side.
- Complete mock payment.
- In `store/admin`, mark ready for pickup.
- Use pickup code to complete verification.

Expected:
- After payment, order enters pickup preparation flow.
- After preparation, order becomes `READY_FOR_PICKUP`.
- After pickup verification, order becomes `COMPLETED`.
- Pickup code and verification result display correctly.

---

## Failure cases

### 10. Multi-SKU product safe rejection
Steps:
- Prepare a product with `SKU count !== 1`.
- Try to update:
  - `defaultSkuName`
  - or `defaultPriceCents`

Expected:
- Backend rejects the request.
- Error:
  - `Current minimal edit only supports single-SKU products`
- No SKU is modified.

---

### 11. Invalid fulfillment config rejection
Steps:
- Edit any product.
- Set:
  - `supportsPickup = false`
  - `supportsShipping = false`
- Try to save.

Expected:
- Backend rejects the request.
- Error:
  - `Product must support at least one fulfillment type`
- Original product state remains unchanged.

---

## Optional extra failure checks

### 12. Invalid initial stock
Expected:
- `initialStock < 0` must be rejected during creation.

### 13. Invalid default price
Expected:
- `defaultPriceCents < 0` must be rejected during creation.

---

## Minimum regression subset to rerun after future changes

At minimum, rerun these 8 checks after changes to product, checkout, inventory, fulfillment, or products API:

1. Admin creates single-SKU product
2. Admin edits product
3. Publish product
4. Storefront web browse + checkout
5. Miniapp browse + checkout
6. Shipping fulfillment flow
7. Store pickup fulfillment flow
8. Failure cases:
   - multi-SKU safe rejection
   - invalid fulfillment config rejection
