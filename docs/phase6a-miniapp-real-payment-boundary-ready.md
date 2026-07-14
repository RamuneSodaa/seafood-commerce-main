# Phase 6A Miniapp Real Payment Boundary Ready

## A. Current state

- Miniapp order detail page shows a pay button only when order status is `PENDING_PAYMENT`
- That button calls `runCustomerPaymentTransition(...)`
- `runCustomerPaymentTransition(...)` currently has only two modes:
  - `mock`: directly calls backend `POST /orders/:id/mark-paid` with a synthetic `paymentRef` like `manual-<timestamp>`
  - `wechat-placeholder`: returns a clear not-implemented message and does not start real payment
- Backend `POST /orders/:id/mark-paid` is a business transition route, not a real payment-provider route
- Backend `markPaid(...)` creates a payment record, reserves inventory, and moves order status from `PENDING_PAYMENT` to:
  - `PAID_PENDING_PREP` for `STORE_PICKUP`
  - `PAID_PENDING_SHIPMENT` for `SHIPPING`
- Current repo config only exposes a frontend payment mode seam through `TARO_APP_PAYMENT_MODE` with `mock | wechat-placeholder`
- No real miniapp payment initiation code, no provider callback route, no callback verification, and no merchant/provider env contract were found

## B. Why current state is not yet real payment

- The pre-payment customer path is already real enough: real auth exchange, signed auth artifact, protected address read, protected order create, protected order reads, and real order detail read are in place
- But actual payment is still transition-only
- The miniapp does not request a provider-side prepay payload
- The miniapp does not call a real provider payment API such as miniapp payment invocation
- The backend does not own a verified provider callback path before marking an order as paid
- The current `markPaid` route can move business state, but it is not a production-safe proof that money was actually authorized and confirmed by a payment provider

## C. Smallest real payment target

- Add one backend customer payment-create seam for a single order that:
  - validates customer access to the order
  - only allows initiation from `PENDING_PAYMENT`
  - returns one minimal miniapp payment-initiation payload for the chosen provider
- Add one miniapp payment-initiation path from order detail that:
  - calls the backend payment-create seam
  - only attempts real provider payment when backend creation succeeds
- Add one minimal verified payment-completion path on the backend that:
  - receives provider callback data
  - verifies provider authenticity
  - maps one verified successful payment event into the existing `markPaid` business transition semantics

## D. Explicitly out of scope

- Refunds
- Finance reconciliation
- Admin payment tooling
- Broad payment-platform abstraction
- Web payment migration
- Broad order-domain rewrite

## E. Single smallest next code task

- Add one backend protected miniapp payment-create skeleton beside the current order routes, for example `POST /orders/:id/create-miniapp-payment`, that accepts no client-paid amount, derives customer identity from the verified auth artifact, validates that the order is still `PENDING_PAYMENT`, and returns a clear not-implemented provider response shape for the future miniapp payment initiation path.
