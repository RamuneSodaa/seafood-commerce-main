## A. Current state

- `POST /orders/:id/create-miniapp-payment` already exists and is protected by `CustomerAuthArtifactGuard`.
- `createMiniappPayment(...)` currently checks order access through `getOrder(...)`, only allows `PENDING_PAYMENT`, and returns a placeholder response:
  - `provider: 'wechat-placeholder'`
  - `initiationType: 'MINIAPP'`
  - `status: 'NOT_IMPLEMENTED'`
  - `orderId`
  - `orderNo`
  - `totalAmountCents`
  - `message`
- The miniapp order-detail pay button already calls this route through `runCustomerPaymentTransition(...)`, but today it only shows placeholder feedback instead of launching real payment.
- The callback side is already much further along: verified callback signature verification exists, verified callback completion reaches `markPaid(...)`, and the callback route now returns provider-safe acknowledgment.
- Initiation is still not real because the create path does not call a real provider API and does not return real launch data for the miniapp to use.

## B. Why current state is not yet full real payment

- The callback/completion side is already capable of safely finishing a real provider payment after verification.
- But `createMiniappPayment(...)` is still only a placeholder skeleton.
- Therefore the repo still lacks the missing half of end-to-end real provider payment: real backend payment initiation for eligible miniapp orders.

## C. Smallest real initiation target

- Add one real backend payment-create method behind the existing protected `POST /orders/:id/create-miniapp-payment` route for miniapp orders only.
- Freeze one minimal payment-initiation response shape for the miniapp frontend:
  - `provider: 'wechat'`
  - `initiationType: 'MINIAPP'`
  - `orderId`
  - `orderNo`
  - `totalAmountCents`
  - `launchParams` object for the real miniapp payment launch
- Keep the minimal order-eligibility rule set:
  - authenticated customer scope only
  - customer must own the order
  - order must still be `PENDING_PAYMENT`
  - client does not supply paid amount
- Add one minimal payment-specific config seam:
  - reuse existing `WECHAT_MINIAPP_APP_ID`
  - introduce a dedicated server-side WeChat payment-create config seam, because current auth-exchange config and callback-verification config are not sufficient to initiate payment

## D. Explicitly out of scope

- refunds
- reconciliation
- admin tooling
- multi-provider abstraction
- web payment migration
- broader order rewrite

## E. Single smallest next code task

- Replace the placeholder body in `createMiniappPayment(...)` with one minimal real WeChat miniapp payment-create client call that preserves the current access and `PENDING_PAYMENT` checks and returns a frozen `launchParams`-based initiation response.
