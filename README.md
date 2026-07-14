<!-- SEAFOOD OWNERSHIP NOTICE BEGIN -->

> **项目所有者及维护者：RamuneSodaa**
>
> 海味干货、天然海鱼、门店自提及配送微信下单商城。
>
> 本仓库用于项目展示、版本管理和开发协作。仓库目前未授予开源许可证。
> 除法律另有规定外，未经项目所有者书面许可，不得复制、商用或重新发布。

<!-- SEAFOOD OWNERSHIP NOTICE END -->

# Seafood Commerce (Phase 1)

Phase 1 delivers the core commerce loop for a seafood retail system:

- product and SKU management
- store-specific availability and inventory
- order creation with `STORE_PICKUP` or `SHIPPING`
- payment-marked inventory reservation
- pickup / shipment fulfillment
- cancellation rollback before the fulfillment boundary
- order status logs and inventory logs for critical transitions

## Tech stack

- API: NestJS + TypeScript
- Web apps: Next.js + TypeScript
- Database: PostgreSQL + Prisma
- Tests: Jest

## Local setup

1. Install dependencies

```bash
npm install
```

2. Configure PostgreSQL and export `DATABASE_URL`

```bash
cp .env.example .env
# Edit .env locally. Never commit the real .env file.
```

3. Generate the Prisma client

```bash
npx prisma generate
```

4. Apply the checked-in migration

```bash
npx prisma migrate deploy
```

If your local database already existed before Prisma migrate baseline management, this repository currently needs one extra SQL step for the new `Product.coverImageUrl` column:

```bash
npx prisma db execute --schema prisma/schema.prisma --file prisma/migrations/20260408153000_add_product_cover_image/migration.sql
```

5. Seed demo data

```bash
npm run seed
```

## Run locally

```bash
# API
npm run start -w @seafood/api

# storefront
npm run dev -w @seafood/storefront-web

# admin
npm run dev -w @seafood/admin-web
```

## Storefront Profiles

Current default profile behavior:

- web storefront defaults to `demo`
- miniapp defaults to `demo`
- default customer identity stays `CUSTOMER + demo-customer`
- default payment mode stays `mock`

If you do not set any extra variables, current behavior remains unchanged.

### Web storefront

Example file:

- `apps/storefront-web/.env.example`

Create a local env file if needed:

```bash
cp apps/storefront-web/.env.example apps/storefront-web/.env.local
```

Available variables:

- `NEXT_PUBLIC_STOREFRONT_PROFILE=demo|dev|test`
- `NEXT_PUBLIC_API_BASE=http://localhost:3000`
- `NEXT_PUBLIC_STOREFRONT_CUSTOMER_USER_ID=demo-customer`
- `NEXT_PUBLIC_STOREFRONT_PAYMENT_MODE=mock|wechat-placeholder`

Examples:

```bash
# switch profile only
NEXT_PUBLIC_STOREFRONT_PROFILE=test npm run dev -w @seafood/storefront-web

# override only customer id
NEXT_PUBLIC_STOREFRONT_CUSTOMER_USER_ID=test-customer npm run dev -w @seafood/storefront-web

# override only payment mode
NEXT_PUBLIC_STOREFRONT_PAYMENT_MODE=wechat-placeholder npm run dev -w @seafood/storefront-web
```

### Miniapp

Example file:

- `apps/storefront-miniapp/.env.example`

Use these variables when starting the Taro build:

- `TARO_APP_PROFILE=demo|dev|test`
- `TARO_APP_API_BASE_URL=http://127.0.0.1:3000`
- `TARO_APP_CUSTOMER_ROLE=CUSTOMER`
- `TARO_APP_CUSTOMER_USER_ID=demo-customer`
- `TARO_APP_PAYMENT_MODE=mock|wechat-placeholder`

Examples:

```bash
# switch profile only
TARO_APP_PROFILE=test npm run dev:weapp -w @seafood/storefront-miniapp

# override only customer id
TARO_APP_CUSTOMER_USER_ID=test-customer npm run dev:weapp -w @seafood/storefront-miniapp

# override only payment mode
TARO_APP_PAYMENT_MODE=wechat-placeholder npm run dev:weapp -w @seafood/storefront-miniapp
```

## Tests and regression

```bash
# API unit + smoke tests
npm test

# API tests directly from workspace package
npm run test -w @seafood/api
```

Notes:

- `apps/api/test/order-workflow.pg.integration.spec.ts` only runs when `DATABASE_URL` is set.
- The API test suite currently covers order permissions, inventory reservation / rollback, and key pickup / shipping transitions.

## Manual end-to-end flow scripts

Two shell scripts can be used against a running local API to sanity-check both fulfillment paths:

```bash
# shipping flow
./phase1-shipping.sh <order-id> <customer-id> [paid-amount-cents]

# pickup flow
./phase1-pickup.sh <order-id> <customer-id> <pickup-code> [paid-amount-cents]
```

Both scripts expect:

- API running at `http://localhost:3000` by default
- `x-role` headers in uppercase
- `x-user-id` for customer-scoped order endpoints

You can override the API host with:

```bash
BASE_URL="http://localhost:3000" ./phase1-shipping.sh <order-id> <customer-id>
```

## Project docs

- Chinese freeze note: `docs/phase1-cn-demo-ready.md`
- Shipping ops stage note: `docs/phase1.1-shipping-ops-ready.md`
- Address contract stage note: `docs/phase1.1b-address-contract-ready.md`
- Checkout address stage note: `docs/phase1.1b-checkout-address-ready.md`
- Address book min scope note: `docs/phase1.1b-address-book-min-scope-ready.md`
- Product single SKU stage note: `docs/phase1-product-single-sku-ready.md`
- Product minimal edit stage note: `docs/phase1-product-min-edit-ready.md`
- Product smoke checklist: `docs/phase1-product-smoke-checklist.md`
- Pricing extension boundary note: `docs/phase2-pricing-extension-boundary-ready.md`
- Pricing service list-price stage note: `docs/phase2-pricing-service-list-price-ready.md`
- Pricing contract placeholder note: `docs/phase2-pricing-contract-placeholder-ready.md`
- Pricing quote shape stage note: `docs/phase2-pricing-quote-shape-ready.md`
- Coupon entry boundary note: `docs/phase2-coupon-entry-boundary-ready.md`
- Coupon request placeholder note: `docs/phase2-coupon-request-placeholder-ready.md`
- Coupon e2e placeholder note: `docs/phase2-coupon-e2e-placeholder-ready.md`
- Coupon order detail display note: `docs/phase2-coupon-order-detail-display-ready.md`
- Coupon checkout input note: `docs/phase2-coupon-checkout-input-ready.md`
- Checkout quote preview note: `docs/phase2-checkout-quote-preview-ready.md`
- Miniapp demo stage note: `docs/phase2a-miniapp-demo-ready.md`
- Login / payment prep note: `docs/phase2b-login-payment-prep-ready.md`
- Real identity entry boundary note: `docs/phase3-real-identity-entry-boundary-ready.md`
- Real identity write adapter note: `docs/phase3-real-identity-write-adapter-ready.md`
- Real identity auth result mapper note: `docs/phase3-real-identity-auth-result-mapper-ready.md`
- Login success orchestrator note: `docs/phase3-login-success-orchestrator-ready.md`
- Auth entry / callback placeholder note: `docs/phase3-auth-entry-callback-placeholder-ready.md`
- Auth exchange / session boundary note: `docs/phase3-auth-exchange-session-boundary-ready.md`
- Auth exchange placeholder note: `docs/phase3-auth-exchange-placeholder-ready.md`

## Role boundary

Use request headers:

- `x-role: ADMIN`
- `x-role: STORE`
- `x-role: CUSTOMER`

Current order scope rules:

- `CUSTOMER` can only list, view, mark paid, and cancel their own orders
- `ADMIN` keeps full order access
- `STORE` keeps workbench permissions for fulfillment operations

## Scope guardrails

Not included in Phase 1:

- coupons
- membership / points
- distribution
- promotion engine
- advanced BI
