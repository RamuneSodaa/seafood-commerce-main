# Phase 1 Gap Audit

## A. What is fully implemented now

- Core domain state machine logic for payment reservation, cancellation rollback, pickup, shipping, and delivered terminal flow in `OrderInventoryService`.
- Stock mutation + status transition logging hooks (`InventoryLog[]`, `OrderStatusLog[]`) for successful operations.
- Prisma schema and SQL migration defining product/SKU/store/inventory/order/shipping/pickup/log models.
- SKU-level store availability via `StoreSkuAvailability` unique `(storeId, skuId)`.
- Shipping address snapshot model (`OrderShippingAddressSnapshot`).
- Jest unit tests covering core reserve/rollback/pickup/shipping/invalid transition/negative stock and additional edge-case correctness tests.

## B. What is only scaffolded / placeholder

- NestJS bootstrap and module/controller wiring are placeholders (`apps/api/src/main.ts`, module README placeholders).
- Seed script is placeholder logs only, not yet PrismaClient insert execution.
- Admin/storefront apps are placeholder package manifests only.

## C. What is partially implemented

- Domain correctness is implemented in-memory service logic, but not yet wired to persistence/repository layer.
- API docs are draft-level route outlines, not OpenAPI or controller-verified.

## D. What is still missing for Phase 1 acceptance

- Real NestJS controllers/services/repositories connecting HTTP endpoints to domain logic.
- Transactional DB-backed implementation (row locking / optimistic checks) instead of in-memory maps.
- Executable Prisma seed with real inserts.
- End-to-end integration tests against DB transaction behavior.

## E. What cannot be verified because tests were not runnable in the current environment

- Automated execution result of the Jest suite (dependency installation blocked by npm registry policy in current environment).
- Runtime compatibility of ts-jest/ts-node toolchain in this environment.
- Migration application against a live PostgreSQL instance in this environment.
