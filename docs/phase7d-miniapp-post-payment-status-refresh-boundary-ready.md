## A. Current state

- After `requestPayment` launch success, `runCustomerPaymentTransition(...)` returns a success result that truthfully says payment was launched and callback-driven status refresh is still pending.
- The order-detail page currently performs one immediate `refreshOrderDetail(order.id, { preserveFeedback: true })` after that success path returns.
- That refresh uses the existing protected order-detail read path when miniapp identity source is `real-storage`, via `getAuthenticatedOrder(...)`.
- There is no frozen polling or bounded retry helper in the miniapp payment path today.
- On the backend, verified callback completion already calls `markPaid(...)`, which moves order status from `PENDING_PAYMENT` to:
  - `PAID_PENDING_PREP`
  - `PAID_PENDING_SHIPMENT`
- Safe duplicate callback acknowledgment also already exists, and backend callback/completion behavior is already in place.

## B. Why current state is not yet a closed post-payment UX

- Payment can already launch from the miniapp.
- Callback verification and completion can already finish the order payment on the backend.
- But the client-side rule for how long the order-detail page should keep checking for a status change after launch is not yet frozen, so post-payment refresh behavior remains incomplete.

## C. Smallest post-payment refresh target

- Keep one immediate order-detail refresh attempt right after `requestPayment` returns success.
- Add one short bounded polling rule only while the current order status is still `PENDING_PAYMENT`.
- Stop polling as soon as status leaves `PENDING_PAYMENT`, because that is the existing backend completion boundary.
- If bounded polling ends and the order still reads as `PENDING_PAYMENT`, show one honest fallback message telling the user that payment was launched but backend confirmation is not visible yet, and that they can manually reopen or refresh the order detail shortly.

## D. Explicitly out of scope

- refunds
- reconciliation
- admin tooling
- broader payment-state redesign
- web payment migration

## E. Single smallest next code task

- Extend the order-detail pay success path to perform one immediate protected order refresh plus one short bounded polling loop that stops once the order status is no longer `PENDING_PAYMENT`.
