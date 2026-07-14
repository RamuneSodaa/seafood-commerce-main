# Phase 4C Shared Auth Import Cleanup Ready

## A. What changed

- shared auth contract consumer imports were cleaned up
- imports moved from deep file path:
  `packages/shared-types/src/auth-contract-types`
  to existing barrel entry:
  `packages/shared-types/src`

## B. What was intentionally not changed

- no runtime behavior changes
- no placeholder endpoint changes
- no frontend identity pipeline changes
- no shared auth contract semantic changes
- no package-entry migration to `@seafood/shared-types`

## C. Verification

- `npm run test -w @seafood/api -- auth-exchange-placeholder.spec.ts`
- `npm run build -w @seafood/storefront-web`
- `npm run build:weapp -w @seafood/storefront-miniapp`

## D. Known blocker / boundary

- true package-entry import is not ready yet because:
  - `packages/shared-types` has no `package.json`
  - app/api tsconfigs do not provide a package-name alias
- therefore Phase 4C stops at safe barrel import cleanup and does not expand into repo infra work

## E. Phase conclusion

- Phase 4C is frozen as import cleanup only
- any future move to true package-entry import must be opened as a separate repo-infra boundary task, not folded into auth work
