# Phase 4A Real Auth Contract Boundary Ready

## 1. Stage goal

This stage only defines the minimal contract boundary for future real auth exchange.

This stage does not:
- implement real WeChat login
- implement token or session
- change order, inventory, payment, or fulfillment state flows

## 2. Existing reusable handoff chain

The current identity/auth handoff chain is already frozen:
- auth result mapper
- login success orchestrator
- real identity write adapter
- identity resolver source priority

Future real auth success must connect into this existing chain. It must not bypass these layers by directly writing frontend identity state.

## 3. Future real auth exchange input boundary

From a contract perspective, future auth exchange input may include:
- provider credential
- provider code
- provider state
- callback payload

This stage does not:
- define real WeChat platform details
- define real security implementation
- define real session strategy

## 4. Future real auth exchange output boundary

The output target must remain a minimal auth success result that can be accepted by the existing auth result mapper, or be explicitly mapped into that result before entering the existing mapper, orchestrator, and write adapter chain.

The output direction should stay:
- role fixed toward `CUSTOMER`
- normalized identity or profile fields only when needed
- provider metadata allowed when useful
- `raw` allowed only for dev or debug discussion

The auth exchange route is not a business entry point and must not own order, payment, inventory, or fulfillment side effects.

The output must not introduce:
- session fields
- token fields
- order state
- payment state
- fulfillment state
- other business status fields

## 5. Explicit non-goals

This stage does not do:
- real WeChat code exchange
- `openid` or `unionid` persistence design
- token or session issuing
- admin or staff auth
- broader user identity system design
- order ownership redesign
- payment-auth coupling

## 6. Next smallest suggested code landing

Next step could be adding one shared contract type or DTO placeholder so web, miniapp, and api can agree on the future auth success shape statically, but that task is not implemented in this document.
