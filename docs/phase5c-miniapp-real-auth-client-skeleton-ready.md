# Phase 5C Miniapp Real Auth Client Skeleton Ready

## A. What was added

- Added a miniapp dev-only real-auth client entry page beside the existing placeholder auth entry
- Added a minimal miniapp API helper for `POST /auth/exchange-real`
- Wired the new page to call `Taro.login()` for a real miniapp auth source and send the login code to the backend real-auth skeleton route

## B. What was intentionally not implemented

- No real WeChat backend code exchange
- No token or session rollout
- No login success orchestration on failure or not-implemented response
- No real identity write on failure or not-implemented response
- No placeholder runtime change

## C. How to verify

- Run `npm run build:weapp -w @seafood/storefront-miniapp`
- Open miniapp dev page `pages/dev-auth-real-entry/index`
- Trigger the action and confirm:
  - `Taro.login()` failure is shown clearly if it happens
  - backend `/auth/exchange-real` not-implemented is shown clearly
  - no real identity is written

## D. Phase conclusion

Phase 5C only lands the first miniapp real-auth client skeleton path to the backend real-auth boundary. It does not treat the boundary as login success and does not start real auth rollout yet.
