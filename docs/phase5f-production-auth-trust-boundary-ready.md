# Phase 5F Production Auth Trust Boundary Ready

## A. Current state

- `POST /auth/exchange-real` already performs a real miniapp upstream code exchange and returns a normalized shared `AuthSuccessResult`.
- The miniapp real-auth dev entry already feeds that success result into the existing client-side chain:
  - auth result mapper
  - login success orchestrator
  - real identity write adapter
  - identity resolver priority
- Web and miniapp still resolve customer identity mainly on the client side from:
  - profile/env override
  - real identity storage
  - placeholder identity storage
  - demo fallback
- Web and miniapp still send customer identity to the backend through request headers such as `x-role` and `x-user-id`.
- Backend customer-facing routes still trust those headers for request scope and access checks.
- What is still missing for production trust is a server-defined and server-verified authenticated customer login-state artifact for later requests.

## B. Why current Phase 5E is not yet enough for production login

- Real upstream auth exchange now exists.
- Real miniapp auth success can now write client-side real identity state.
- But later customer requests are still not authenticated by a backend-issued login-state artifact.
- Current backend trust for customer scope is still largely based on client-provided identity headers and role headers.
- Therefore the current real auth path is not yet the same thing as production-secure authenticated customer access.

## C. Smallest production trust target

The smallest credible production trust target is:

- after `/auth/exchange-real` succeeds, the backend issues one minimal signed customer login-state artifact
- later customer requests present that artifact
- the backend verifies that artifact and derives customer identity from server-verified auth state
- customer route trust then starts moving from client-provided `x-user-id` / `x-role` toward backend-verified authenticated customer identity

At this boundary, the goal is not a full auth platform. The goal is to define one minimal server-trusted login state so later customer requests are not trusted only because the client says who it is.

## D. Explicitly out of scope

- payment
- admin or staff auth
- full account center
- refresh-token or advanced auth platform work
- broad RBAC refactor
- broad repo infra rewrite

## E. Single smallest next code task

Add a minimal backend-issued signed customer auth artifact response contract to `/auth/exchange-real`, plus one backend verification seam that can read and validate that artifact for later customer requests, without rolling it through all customer routes yet.
