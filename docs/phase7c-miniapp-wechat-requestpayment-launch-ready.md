## A. what was added

- Added one tiny miniapp WeChat payment launch helper around `requestPayment`.
- Upgraded the real-auth miniapp pay path to use backend `launchParams` and actually call the miniapp payment launch API.
- Kept UI feedback honest:
  - launch success now means payment was launched
  - cancel and launch failure are surfaced honestly
  - the order-detail page no longer claims backend payment completion immediately after launch

## B. what was intentionally not implemented

- No backend callback or completion changes.
- No refunds.
- No reconciliation.
- No web payment work.
- No broader payment state-machine redesign.

## C. how to verify

- Run `npx tsc -p apps/storefront-miniapp/tsconfig.json --noEmit` from the repo root.
- Run `npm run build:weapp` in `apps/storefront-miniapp`.
- In the miniapp real-auth order-detail pay path, confirm backend `launchParams` are passed into the miniapp payment API and success/cancel/failure messages stay honest.

## D. phase conclusion

Phase 7C adopts real WeChat `requestPayment` launch on the miniapp client while keeping backend callback/completion behavior untouched.
