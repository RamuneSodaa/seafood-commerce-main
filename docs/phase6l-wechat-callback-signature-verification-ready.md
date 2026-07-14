## A. what was added

- Implemented real WeChat Pay callback signature verification in `MiniappPaymentCallbackVerificationService` using `Wechatpay-Timestamp`, `Wechatpay-Nonce`, `Wechatpay-Serial`, raw callback body, and SHA256-RSA verification against payment-specific env config.
- Added the smallest correct payment verification config seam: `WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM` and `WECHAT_PAY_PLATFORM_SERIAL`.
- Enabled raw callback body capture in the API bootstrap and wired the callback controller/workflow path to return a verified pre-completion result that still stops before `markPaid(...)`.
- Added focused tests for verification success, missing config, serial mismatch, invalid signature, controller forwarding, and the verified extraction/mapping seam.

## B. what was intentionally not implemented

- No `markPaid(...)` call.
- No order, payment, inventory, or fulfillment mutation.
- No refund, reconciliation, admin payment tooling, or frontend changes.
- No callback payload decryption or payment completion flow.

## C. how to verify

- Run `npx jest --runInBand test/order-workflow.service.smoke.spec.ts test/orders.controller.spec.ts` in `apps/api`.
- Run `npx tsc -p apps/api/tsconfig.json --noEmit` from the repo root.
- Confirm the callback verification tests pass for valid signature, missing config, serial mismatch, and invalid signature.

## D. phase conclusion

Phase 6L is now the first real WeChat callback authenticity step: the backend can verify a signed callback with payment-specific config and stop at a verified-but-not-applied boundary.
