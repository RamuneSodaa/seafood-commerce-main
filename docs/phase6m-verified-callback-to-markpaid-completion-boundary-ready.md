## A. Current state

- The callback route `POST /orders/miniapp-payment-callback` already lands provider input, receives the WeChat callback headers, and forwards the raw callback body into `handleMiniappPaymentCallback(...)`.
- `MiniappPaymentCallbackVerificationService` can already verify real WeChat callback authenticity/signature and reject invalid serials or signatures.
- After verification, the current callback path already produces a verified pre-completion result with:
  - `stage: 'CALLBACK_VERIFICATION'`
  - `status: 'VERIFIED'`
  - `extractedCallback`
  - `businessInput` containing `orderNo`, `paymentRef`, and `paidAmountCents`
- `markPaid(orderId, paymentRef, paidAmountCents, actor?)` already owns the real business mutation path:
  - locks the order
  - rejects non-`PENDING_PAYMENT`
  - enforces `paymentRef` uniqueness
  - creates the payment record
  - reserves inventory
  - updates order status
  - writes order status logs and inventory logs
- Current repository lookup seams are still order-id based. The repository has `getOrder(tx, orderId)` and `getOrderDetail(orderId)`, but no dedicated order lookup by verified merchant order number.
- Current duplicate payment semantics are already defined inside `markPaid(...)`:
  - same `paymentRef` on the same order returns `IGNORED_DUPLICATE`
  - same `paymentRef` on a different order throws `Duplicate paymentRef used for a different order`

## B. Why current state is not yet payment completion

- Callback authenticity can now be verified, but verification alone does not freeze when a verified callback is allowed to drive order payment completion.
- The repo has no frozen seam yet that resolves verified `orderNo` into the exact target order record for `markPaid(...)`.
- The repo has no frozen callback-specific rule yet for how to handle repeat verified callbacks when `markPaid(...)` returns `IGNORED_DUPLICATE` or when the order is already no longer `PENDING_PAYMENT`.
- The callback route currently returns a verified pre-completion payload with `200`, but no completion-vs-failure acknowledgment rule is frozen yet for the future mutation path.

## C. Smallest completion target

- Add one callback completion method that runs only after signature verification succeeds.
- Add one repository lookup seam that finds exactly one order by verified merchant order number.
- Map the already-produced verified callback business input directly into `markPaid(orderId, paymentRef, paidAmountCents)` after the order is resolved by `orderNo`.
- Freeze duplicate/repeat callback behavior as:
  - if the same verified `paymentRef` was already applied to the same order, treat the callback as safely acknowledged duplicate
  - if the same verified `paymentRef` points to a different order, reject clearly
  - if the order cannot be resolved by verified `orderNo`, reject clearly
  - if `markPaid(...)` rejects because the order is no longer eligible for payment completion, treat that as explicit callback completion failure until a narrower rule is later introduced
- Freeze callback acknowledgment as:
  - return HTTP `200` only after verified callback completion succeeds or is recognized as a safe duplicate for the same order
  - return an error response for verification failure, order lookup failure, cross-order duplicate conflict, or invalid business transition

## D. Explicitly out of scope

- refunds
- reconciliation
- admin tooling
- multi-provider abstraction
- web payment migration
- broad order rewrite

## E. Single smallest next code task

- Implement one minimal verified callback completion seam that resolves the verified `businessInput.orderNo` to an order, calls `markPaid(orderId, paymentRef, paidAmountCents)`, and returns a callback-safe `200` acknowledgment for `APPLIED` and same-order `IGNORED_DUPLICATE` only.
