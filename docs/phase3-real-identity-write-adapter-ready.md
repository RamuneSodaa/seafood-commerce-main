# Phase 3 Real Identity Write Adapter Ready

## 1. What was added

Web and miniapp now each provide one thin write adapter for the future "real login success" write path.

The adapter is the single write entry for:
- writing real customer identity into real identity storage
- clearing placeholder identity after a successful real identity write
- returning the current resolved identity result after the write

Page-level code should prefer calling the adapter instead of directly calling storage helpers when the intent is "real login success".

## 2. What was intentionally not changed

This stage does not implement:
- real WeChat login
- `openid` / `unionid`
- token / session integration
- user center capability

This stage does not change:
- provider read priority
- backend API contract
- request layer behavior
- order, payment, inventory, or fulfillment main flows

## 3. Current write adapter semantics

The current adapter semantics are:
- future real login success
- write real identity
- clear placeholder identity
- return the current resolved identity result

This is only a single write entry for future real login success. It is not the login implementation itself.

## 4. How to verify

1. Run:
   - `npm run build -w @seafood/storefront-web`
   - `npm run build:weapp -w @seafood/storefront-miniapp`
2. Open the existing dev identity page in web or miniapp.
3. Write a placeholder identity first, then write a real identity through the real-identity action.
4. Confirm the placeholder value is cleared.
5. Confirm the provider resolves to `real-storage` when no profile / env override is active.
6. Confirm profile / env override still stays first when configured.

## 5. Current phase conclusion

Phase 3 now has a clear and replaceable real identity write entry, without expanding into real login, token/session integration, or business flow changes.
