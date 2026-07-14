# Phase 3 Real Identity Auth Result Mapper Ready

## 1. What was added

Web and miniapp now each provide one thin auth result mapper for the future "auth/login success result -> real identity" path.

The mapper is the single normalization entry for:
- accepting a future auth success result shape
- normalizing it into the current real identity shape used by the write adapter
- keeping page-level code from manually assembling real identity objects

Page-level code should prefer:
- auth result mapper
- real identity write adapter

instead of directly constructing identity payloads.

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

## 3. Current auth result mapper semantics

The current mapper semantics are:
- future auth/login success result
- normalize into current real identity
- pass the normalized result into the real identity write adapter

This mapper is not the login implementation itself. It only defines the normalization boundary between future auth results and the current real identity write entry.

## 4. How to verify

1. Run:
   - `npm run build -w @seafood/storefront-web`
   - `npm run build:weapp -w @seafood/storefront-miniapp`
2. Open the existing dev identity page in web or miniapp.
3. Use the real identity write action, which now runs:
   - mock auth result
   - auth result mapper
   - real identity write adapter
4. Confirm the real identity is written into real storage.
5. Confirm the provider resolves to `real-storage` when no profile / env override is active.
6. Confirm profile / env override still stays first when configured.

## 5. Current phase conclusion

Phase 3 now has a clear and replaceable auth-result normalization entry before the real identity write adapter, without expanding into real login, token/session integration, or business flow changes.
