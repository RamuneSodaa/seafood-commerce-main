# Phase 3 Login Success Orchestrator Ready

## 1. What was added

Web and miniapp now each provide one thin login success orchestrator for the future "login success" entry path.

The orchestrator is the single entry for:
- accepting a future auth success result
- calling the auth result mapper
- calling the real identity write adapter
- returning the final resolved identity result

Page-level code should prefer calling the orchestrator instead of separately calling the mapper and the write adapter.

## 2. What was intentionally not changed

This stage does not implement:
- real WeChat login
- real login requests
- `openid` / `unionid`
- token / session integration
- user center capability

This stage does not change:
- provider read priority
- backend API contract
- request layer behavior
- order, payment, inventory, or fulfillment main flows

## 3. Current login success orchestrator semantics

The current orchestrator semantics are:
- auth success result
- auth result mapper
- real identity write adapter
- resolved identity result

This orchestrator is not the login implementation itself. It only provides one thin entry that composes the existing mapper and write adapter for future login success handling.

## 4. How to verify

1. Run:
   - `npm run build -w @seafood/storefront-web`
   - `npm run build:weapp -w @seafood/storefront-miniapp`
2. Open the existing dev identity page in web or miniapp.
3. Use the real identity write action, which now runs:
   - mock auth result
   - login success orchestrator
4. Confirm the orchestrator writes the real identity into real storage.
5. Confirm the provider resolves to `real-storage` when no profile / env override is active.
6. Confirm placeholder identity is cleared after the write.
7. Confirm profile / env override still stays first when configured.

## 5. Current phase conclusion

Phase 3 now has a clear and replaceable login-success entry that composes the existing mapper and write adapter, without expanding into real login, token/session integration, or business flow changes.
