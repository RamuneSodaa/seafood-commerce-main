# P2D1A-R1 Payment Safety Hardening

## Scope

This stage is code-only and fail-closed. It does not create orders, payments or refunds; it does not modify inventory, production data, Railway variables, Git history or deployment state.

## Implemented

- Added backend `PAYMENT_RUNTIME_MODE` hard switch. Missing or `disabled` rejects payment creation. Only normalized `wechat_live` enables payment creation.
- Added miniapp defense-in-depth. Only `TARO_APP_PAYMENT_MODE=wechat-live` attempts the payment API.
- Added order access checks to order notes and all fresh-preorder admin transitions.
- Expanded the order access-scope lookup to include `customerId` and `storeId`, so those checks are type-safe and enforceable.
- Required explicit `WECHAT_PAY_MODE=direct|partner` in both payment creation and callback handling.
- Tightened the public callback path to require a native encrypted WeChat Pay resource envelope.
- Tightened native WeChat Pay callback mapping: required `TRANSACTION.SUCCESS`, required `trade_state=SUCCESS`, and required merchant/AppID identity match.
- Added regression tests for fail-closed payment mode, cross-store access denial, non-native callback rejection and callback identity checks.

## Runtime conventions

The backend and miniapp deliberately use different environment-variable value formats:

```text
PAYMENT_RUNTIME_MODE=wechat_live
TARO_APP_PAYMENT_MODE=wechat-live
```

Both must remain disabled or unset until the controlled live-payment gate. The backend switch blocks creation of new prepay orders. Valid signed callbacks continue to be processed so an already-initiated payment cannot be lost during an emergency shutdown.

## Deliberately not implemented in R1

- No payment-ledger schema migration.
- No active order query or reconciliation.
- No refund API.
- No production admin deployment.
- No merchant secret configuration.
- No live payment enablement.

## Safe runtime state after R1

Keep production unset or explicitly set:

```text
PAYMENT_RUNTIME_MODE=disabled
```

Do not configure `wechat_live` until later controlled payment gates pass.
