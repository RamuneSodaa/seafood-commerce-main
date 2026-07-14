## A. Current real path already in place

- Real WeChat auth exchange exists on the backend and returns a signed customer `authArtifact`.
- The miniapp already stores and uses that signed `authArtifact` for protected customer address, checkout, order list, and order detail paths.
- The checkout page can read addresses, create authenticated orders, and send coupon code plus fulfillment choice through the real miniapp order-create path.
- The backend real miniapp payment-create path exists and only allows eligible `PENDING_PAYMENT` orders.
- The miniapp already uses backend `launchParams` to call real WeChat `requestPayment`.
- Verified callback signature verification already exists.
- Verified callback completion already reaches `markPaid(...)`.
- The callback route already returns provider-safe acknowledgment.
- The miniapp order-detail page already does bounded post-payment status refresh after launch.

## B. What is still not MVP-ready

- The real auth entry is still centered on dev-only miniapp pages such as `pages/dev-auth-real-entry/index`, and that page explicitly says it is only for development verification rather than a complete production login entry.
- The miniapp app config still includes dev-only pages in the shipped page list.
- Standalone miniapp TypeScript checking still fails in untouched dev pages with pre-existing `TS1382` parse errors, which is a non-production repo caveat even though the weapp build succeeds.

## C. Smallest MVP target

- A real customer can enter the miniapp through a normal non-dev login entry, complete real auth exchange once, persist the signed `authArtifact`, and then use the existing protected checkout, order, payment-launch, callback-completion, and post-payment refresh path without needing any dev-only page.

## D. Explicitly out of scope

- refunds
- reconciliation
- admin tooling
- broad platformization
- web payment parity
- broad repo cleanup

## E. Single smallest next code task

- Replace the current dev-only real auth entry dependency with one normal miniapp customer login entry that runs the existing real auth exchange flow and persists the returned `authArtifact` for the already-implemented protected commerce path.
