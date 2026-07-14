# Phase 5D Backend Real Auth Exchange Minimal Implementation Ready

## A. What was added

- Upgraded `POST /auth/exchange-real` from a not-implemented skeleton to a real miniapp code-exchange path
- Tightened the real-auth DTO to require `providerCode`
- Added a small backend Wechat miniapp exchange client using backend env config
- Normalized successful upstream exchange into the shared `AuthSuccessResult`

## B. What was intentionally not implemented

- No token issuance
- No session rollout
- No openid or unionid persistence design
- No account center or admin auth
- No frontend success-path wiring
- No placeholder flow change

## C. How to verify

- Run `npm run test -w @seafood/api -- auth-exchange-placeholder.spec.ts`
- Run `npm run test -w @seafood/api -- auth-exchange-real.spec.ts`
- Run `npx tsc -p apps/api/tsconfig.json --noEmit`

## D. Phase conclusion

Phase 5D only lands the smallest real backend miniapp auth exchange implementation behind `POST /auth/exchange-real`. It returns a normalized auth success result on true upstream success and does not fake login success on failure.
