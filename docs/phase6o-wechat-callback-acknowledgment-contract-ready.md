## A. Current state

- `POST /orders/miniapp-payment-callback` is handled by `OrdersController.handleMiniappPaymentCallback(...)` and is annotated with `@HttpCode(200)`.
- The controller currently returns whatever `OrderWorkflowService.handleMiniappPaymentCallback(...)` returns on normal completion.
- Today that workflow returns a business-facing payload shaped like:
  - `stage`
  - `provider`
  - `status`
  - `orderId`
  - `orderNo`
  - `paymentRef`
  - `paidAmountCents`
  - `message`
- Current verified completion results inside the callback path are:
  - success: `APPLIED`
  - safe duplicate: `IGNORED_DUPLICATE`
- Current failure paths still throw normal Nest exceptions, including at least:
  - verified `orderNo` not found
  - cross-order duplicate `paymentRef`
  - invalid payment completion transition
  - unsupported provider
- The API already has a shared exception shape through `HttpErrorFilter`, which returns `success: false` plus `error.code`, `error.message`, `error.details`, `error.path`, and `error.timestamp`.
- The current callback success payload is still internal/business-facing because it exposes order and payment business details that were produced for application logic, not for a frozen provider-facing callback acknowledgment contract.

## B. Why current state is not yet a hardened provider-facing callback contract

- Verified callback completion now works end to end and safely reaches `markPaid(...)`.
- But callback response shaping is still coupled to internal business completion details such as `status`, `orderId`, `orderNo`, `paymentRef`, and `paidAmountCents`.
- That means the provider-facing acknowledgment semantics are not yet frozen, because the current `200` response body still reflects internal application state instead of a minimal callback acknowledgment contract.

## C. Smallest acknowledgment target

- Define one provider-safe success acknowledgment shape for completed verified callbacks:
  - HTTP `200`
  - fixed minimal body: `{ "acknowledged": true }`
- Define one provider-safe safe-duplicate acknowledgment shape for verified same-order duplicate callbacks:
  - HTTP `200`
  - fixed minimal body: `{ "acknowledged": true }`
- Define one provider-safe failure rule:
  - if verified callback completion does not finish successfully or as a safe duplicate, do not return the success acknowledgment body; let the request fail through the existing exception path instead of pretending success
- Define one internal-only rule:
  - `stage`, `provider`, `status`, `orderId`, `orderNo`, `paymentRef`, `paidAmountCents`, and human-readable business completion messages remain internal service/test data and must no longer be treated as provider-facing callback response fields

## D. Explicitly out of scope

- refunds
- reconciliation
- admin tooling
- multi-provider abstraction
- web payment migration
- broader order rewrite

## E. Single smallest next code task

- Change `handleMiniappPaymentCallback(...)` so both `APPLIED` and same-order `IGNORED_DUPLICATE` return the same fixed HTTP `200` acknowledgment body, while all other paths keep failing through the existing exception flow.
