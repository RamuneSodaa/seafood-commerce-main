# Phase 3 Auth Exchange Session Boundary Ready

## 1. Current frontend identity pipeline

The current frontend identity pipeline is already frozen as:
- auth entry / callback placeholder
- login success orchestrator
- auth result mapper
- real identity write adapter
- resolver / provider priority

This pipeline should stay in place. The next step is not to replace it, but to define how a future backend auth exchange or session result should connect into it.

## 2. Recommended frontend/backend boundary for future auth exchange

The most stable boundary is:
- frontend collects a minimal auth success payload from the platform side
- frontend sends that payload to a future backend auth exchange endpoint
- backend verifies or exchanges platform auth state
- backend returns a very small normalized customer identity result
- frontend feeds that result back into the existing orchestrator / mapper / adapter chain

This keeps the backend responsible for real auth verification and future session issuance, while keeping the frontend identity pipeline small and replaceable.

## 3. Suggested minimal frontend payload

The frontend should submit only the smallest fields needed for future auth exchange, for example:
- `provider`
- `authCode` or equivalent platform exchange token
- optional lightweight debug metadata when running in dev

The frontend should avoid sending a large user profile object or embedding business-specific order or payment context into the auth exchange payload.

## 4. Suggested minimal backend result

The backend should return only a very small result, enough for the frontend to continue writing real identity, for example:
- `provider`
- `userId`
- `role`
- optional `displayName`

If a future session or token is needed, it should remain an additional backend-owned concern and should not expand the frontend identity write shape unless truly necessary.

## 5. How frontend should reconnect to the existing pipeline

After the future backend auth exchange returns its small normalized result, the frontend should continue through the already-frozen path:
- auth entry / callback receives backend result
- login success orchestrator is called
- orchestrator uses the existing mapper
- mapper normalizes into current real identity
- write adapter writes real identity

The future backend exchange should plug into the existing pipeline, not replace it.

## 6. Explicitly out of scope now

This stage does not implement:
- real WeChat login
- real auth exchange request handling
- real token / session issuance
- `openid` / `unionid` processing
- backend auth controller changes
- permission redesign

This stage also does not change:
- order, payment, inventory, or fulfillment main flows

## 7. Next smallest implementation suggestion

The next smallest implementation should be one minimal backend placeholder endpoint contract for auth exchange, returning only the small normalized identity result needed by the current frontend pipeline.
