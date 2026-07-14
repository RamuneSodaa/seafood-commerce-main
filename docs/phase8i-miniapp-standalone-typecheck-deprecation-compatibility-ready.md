## A. what was added

- Added the minimal TypeScript 6 compatibility setting to `apps/storefront-miniapp/tsconfig.json` so standalone miniapp typecheck no longer fails on the `moduleResolution=node10` deprecation warning path.
- Kept the existing Taro/weapp build-oriented compiler settings intact.

## B. what was intentionally not implemented

- No auth changes.
- No payment changes.
- No broader tsconfig modernization.
- No module-resolution behavior rewrite.

## C. how to verify

- Run `npx tsc -p apps/storefront-miniapp/tsconfig.json --noEmit`.
- Run `npm run build:weapp` in `apps/storefront-miniapp`.
- Confirm standalone miniapp typecheck no longer fails on `TS5107`.

## D. phase conclusion

- Phase 8I resolves the remaining standalone miniapp typecheck deprecation blocker with one narrow compatibility adjustment while preserving the current build assumptions.
