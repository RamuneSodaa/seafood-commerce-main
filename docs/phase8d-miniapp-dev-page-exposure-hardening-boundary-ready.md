## A. Current state

- Normal customer-facing miniapp pages now exist for the MVP path, including `pages/products/index`, `pages/customer-login/index`, `pages/checkout/index`, `pages/orders/index`, and `pages/order-detail/index`.
- Dev-only miniapp pages still remain exposed in `apps/storefront-miniapp/src/app.config.ts`:
  - `pages/dev-auth-entry/index`
  - `pages/dev-auth-real-entry/index`
  - `pages/dev-identity/index`
- Those dev-only pages still describe themselves as development/debug pages and still link mainly to each other rather than from the normal customer-facing path.
- The known standalone miniapp `tsc` caveat is still concentrated in those untouched dev pages, with pre-existing `TS1382` parse failures previously observed in `dev-auth-entry`, `dev-auth-real-entry`, and `dev-identity`.

## B. Why current state is not yet clean MVP exposure

- The normal customer login entry and protected commerce path now exist.
- But dev-only pages still remain in the shipped miniapp page exposure through `app.config.ts`.
- Those same dev-only pages still carry the known non-production caveat area, so their continued exposure keeps the miniapp surface less clean than the MVP customer path now requires.

## C. Smallest hardening target

- Remove the dev-only miniapp pages from the normal shipped page exposure in `apps/storefront-miniapp/src/app.config.ts`, while leaving the underlying files untouched for local development reference.
- Keep the normal MVP customer path limited to the non-dev pages that already support customer login, protected reads, checkout, orders, and order detail.

## D. Explicitly out of scope

- auth redesign
- payment changes
- refunds
- reconciliation
- broad repo cleanup
- web work

## E. Single smallest next code task

- Update `apps/storefront-miniapp/src/app.config.ts` to remove `pages/dev-auth-entry/index`, `pages/dev-auth-real-entry/index`, and `pages/dev-identity/index` from the miniapp page list while keeping the new normal customer pages intact.
