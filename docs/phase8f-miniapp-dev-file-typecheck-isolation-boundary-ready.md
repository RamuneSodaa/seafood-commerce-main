## A. Current state

- Customer-facing miniapp page exposure is already cleaned up in `apps/storefront-miniapp/src/app.config.ts` and now contains only the normal pages:
  - `pages/products/index`
  - `pages/customer-login/index`
  - `pages/product-detail/index`
  - `pages/checkout/index`
  - `pages/orders/index`
  - `pages/order-detail/index`
- Dev-only files still remain in the repo at:
  - `apps/storefront-miniapp/src/pages/dev-auth-entry/index.tsx`
  - `apps/storefront-miniapp/src/pages/dev-auth-real-entry/index.tsx`
  - `apps/storefront-miniapp/src/pages/dev-identity/index.tsx`
- `apps/storefront-miniapp/tsconfig.json` currently includes all `src/**/*.tsx` and only excludes `dist` and `node_modules`, so those dev-only files still participate in standalone miniapp typecheck.
- The current standalone miniapp typecheck caveat therefore remains the same pre-existing `TS1382` parse failures coming from those untouched dev-only files.

## B. Why current state is not yet clean engineering readiness

- The customer-facing MVP path is already fine.
- But standalone miniapp typecheck is still polluted by dev-only files that are no longer part of normal shipped page exposure.
- Therefore engineering readiness is still not clean even though the customer path itself is already isolated.

## C. Smallest isolation target

- Exclude the three specific dev-only page files from the normal standalone miniapp typecheck surface while leaving the files themselves untouched in the repo.
- Keep normal customer-facing miniapp source files inside the standard standalone typecheck path.

## D. Explicitly out of scope

- auth redesign
- payment changes
- refunds
- reconciliation
- broad repo cleanup
- deleting the dev-only files outright unless clearly justified later

## E. Single smallest next code task

- Update `apps/storefront-miniapp/tsconfig.json` to exclude `src/pages/dev-auth-entry/index.tsx`, `src/pages/dev-auth-real-entry/index.tsx`, and `src/pages/dev-identity/index.tsx` from the standalone miniapp typecheck include surface.
