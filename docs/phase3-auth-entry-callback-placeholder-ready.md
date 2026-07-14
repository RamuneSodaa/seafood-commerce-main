# Phase 3 Auth Entry Callback Placeholder Ready

## 1. What was added

Web and miniapp now each provide one thin frontend auth entry / callback placeholder for the future "auth success" handoff path.

The placeholder entry is responsible for:
- accepting a mock or future auth success payload
- calling the existing login success orchestrator
- showing the current resolved identity and source as minimal feedback

Page-level code should prefer:
- auth entry / callback
- login success orchestrator

instead of assembling the internal chain directly.

## 2. What was intentionally not changed

This stage does not implement:
- real WeChat login
- real auth requests
- `openid` / `unionid`
- token / session integration
- user center capability

This stage does not change:
- provider read priority
- backend API contract
- request layer behavior
- order, payment, inventory, or fulfillment main flows

## 3. Current auth entry / callback placeholder semantics

The current placeholder semantics are:
- receive mock or future auth success payload
- call the existing login success orchestrator
- return or display the resolved identity result

This is only a frontend placeholder entry for future auth success handling. It is not the real login implementation.

## 4. How to verify

1. Run:
   - `npm run build -w @seafood/storefront-web`
   - `npm run build:weapp -w @seafood/storefront-miniapp`
2. Open:
   - web: `/dev/auth-entry`
   - miniapp: `/pages/dev-auth-entry/index`
3. Submit a mock auth success payload.
4. Confirm the resolved identity feedback is shown.
5. Confirm the provider resolves to `real-storage` when no profile / env override is active.
6. Confirm profile / env override still stays first when configured.

## 5. Current phase conclusion

Phase 3 now has a clear and replaceable frontend placeholder entry for future auth success handoff, without expanding into real login, real auth requests, token/session integration, or business flow changes.
