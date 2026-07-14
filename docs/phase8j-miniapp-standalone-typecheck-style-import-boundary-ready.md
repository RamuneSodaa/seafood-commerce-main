## A. Current state

- The miniapp engineering surface is already cleaner than before:
  - dev-only page exposure has been removed from `app.config.ts`
  - dev-only files have been isolated from standalone miniapp typecheck
  - the TypeScript 6 deprecation blocker has already been addressed
  - `npm run build:weapp` still succeeds
- Standalone miniapp typecheck now fails on `src/app.tsx` because of `TS2882` for the side-effect import `import './app.scss';`.
- Repo scan shows the current SCSS import pattern in the miniapp is that one side-effect import in `src/app.tsx`.
- Repo scan also shows there is currently no local `*.d.ts` style declaration file in `apps/storefront-miniapp/src`.
- This is different from `TS5107` and the earlier dev-page failures because the remaining issue is now asset/style-import typing rather than compiler-option deprecation or excluded dev-page source parsing.

## B. Why current state is not yet clean engineering readiness

- The customer-facing path is fine.
- Standalone typecheck has already moved past the deprecation blocker and the dev-only file blockers.
- But standalone typecheck still fails on style-import typing, so engineering readiness is still not fully clean.

## C. Smallest hardening target

- Add one minimal style-import declaration seam so standalone miniapp typecheck accepts the existing side-effect SCSS import while keeping current Taro/weapp build assumptions intact.
- Keep the change narrower than a broad asset-typing overhaul.

## D. Explicitly out of scope

- auth redesign
- payment changes
- refunds
- reconciliation
- broad repo cleanup
- broad asset-typing overhaul unless clearly required

## E. Single smallest next code task

- Add one small declaration file under `apps/storefront-miniapp/src` that declares `*.scss` modules for TypeScript so `src/app.tsx` no longer fails standalone miniapp typecheck on `import './app.scss';`.
