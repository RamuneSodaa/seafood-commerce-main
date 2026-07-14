# Phase 5A Real Auth Minimal Integration Boundary Ready

## A. Production target

The production target we are now moving toward is real customer login for WeChat miniapp connection.

This phase is not:
- real payment
- full customer account system
- full production rollout

## B. Existing chain that must be reused

The current chain that must be reused is:
- auth result mapper
- login success orchestrator
- real identity write adapter
- identity resolver priority
- backend auth exchange entry

Future real auth success must connect into this chain. It must not bypass these layers by directly writing client identity state.

## C. First minimal real-auth landing

The first real auth landing should minimally include:
- a real miniapp auth entry source replacing only the current mock auth payload source
- a backend real auth exchange endpoint boundary beside the existing placeholder exchange entry
- a normalized auth success result that feeds the existing chain unchanged
- a minimal login-state boundary only if it is required to define the next endpoint contract

At this phase, the main goal is not platform completeness. The goal is to let one future real auth success result enter the already-frozen client and backend handoff path safely.

## D. Explicitly out of scope for Phase 5A

This phase does not include:
- real payment
- shipping ops redesign
- admin or staff auth
- full account center
- member, points, or coupon expansion
- broad repo infra refactor

## E. Next smallest code task

The next smallest code task should be adding one real-auth exchange route skeleton beside the existing placeholder route, with minimal request and response DTOs aligned to the current chain, but without enabling real WeChat platform logic yet.
