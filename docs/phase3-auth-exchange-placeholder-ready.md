# Phase 3 Auth Exchange Placeholder Ready

## 1. What was added

A minimal backend auth exchange placeholder endpoint is now covered by focused automated tests.

The tested placeholder behavior is:
- receive a minimal auth payload
- normalize the result into a very small frontend-consumable shape
- keep the current frontend identity pipeline unchanged

## 2. What was intentionally not changed

This stage does not implement:
- real WeChat login
- real auth exchange
- real token or session issuance
- `openid` or `unionid` processing
- formal auth middleware

This stage also does not change:
- order, payment, inventory, or fulfillment main flows
- existing frontend identity pipeline structure

## 3. Current auth exchange placeholder semantics

The placeholder semantics are:
- client submits `provider`, `userId`, optional `displayName`, and optional `raw`
- server always returns role as `CUSTOMER`
- `raw` is only a placeholder debug passthrough
- no session or business state is created

This is a placeholder or dev-facing boundary, not a formal production auth API.

## 4. How to verify

1. Run the focused test:
   - `npm run test -w @seafood/api -- auth-exchange-placeholder.spec.ts`
2. Confirm the service result always fixes role to `CUSTOMER`.
3. Confirm `raw` is returned only as passthrough debug data.
4. Confirm the result contains no session, token, or business status fields.
5. Confirm the controller simply forwards the DTO to the service and returns the placeholder result.

## 5. Current phase conclusion

The auth exchange placeholder behavior is now minimally locked down by tests, including the three current boundaries:
- client cannot decide role
- `raw` is debug passthrough only
- this endpoint is placeholder or dev semantics, not formal auth
