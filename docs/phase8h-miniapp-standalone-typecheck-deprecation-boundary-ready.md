## A. Current state

- The customer-facing engineering surface is already clean enough for the current MVP path:
  - dev-only pages have been removed from `apps/storefront-miniapp/src/app.config.ts`
  - dev-only page files have been excluded from `apps/storefront-miniapp/tsconfig.json`
  - `npm run build:weapp` still succeeds for the normal miniapp build path
- Standalone miniapp typecheck now fails on `TS5107` rather than on the earlier dev-page parse failures.
- The current blocker comes from `apps/storefront-miniapp/tsconfig.json` using `compilerOptions.moduleResolution = "Node"` together with TypeScript `^6.0.2`, where that legacy node10-style setting is now deprecated.
- This is different from the earlier dev-page parse failures because the remaining failure is now a compiler-option compatibility issue in shared config, not file-content errors inside excluded dev-only pages.

## B. Why current state is not yet clean engineering readiness

- The customer path and weapp build are already fine.
- Dev-only file pollution is already isolated from standalone typecheck.
- But standalone miniapp typecheck still fails due to compiler-option compatibility, so engineering readiness is not yet fully clean.

## C. Smallest hardening target

- Make one minimal `tsconfig` compatibility adjustment in `apps/storefront-miniapp/tsconfig.json` so standalone miniapp typecheck no longer fails on the `moduleResolution=node10` deprecation while keeping the current Taro/weapp build assumptions intact.
- Keep the fix narrower than a broad `tsconfig` rewrite.

## D. Explicitly out of scope

- auth redesign
- payment changes
- refunds
- reconciliation
- broad repo cleanup
- broad tsconfig restructuring unless clearly required

## E. Single smallest next code task

- Update `apps/storefront-miniapp/tsconfig.json` to add the minimal compatibility adjustment for the current TypeScript 6 deprecation, with the smallest safe target being `compilerOptions.ignoreDeprecations = "6.0"` unless scanning immediately proves a narrower module-resolution change is both safe and unnecessary to defer.
