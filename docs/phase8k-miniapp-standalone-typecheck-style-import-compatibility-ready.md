## A. what was added

- Added one small local declaration file under `apps/storefront-miniapp/src` for `*.scss`.
- Kept the existing `import './app.scss';` pattern unchanged while making standalone miniapp typecheck accept it.

## B. what was intentionally not implemented

- No auth changes.
- No payment changes.
- No build-toolchain changes.
- No broad asset-typing overhaul.

## C. how to verify

- Run `npx tsc -p apps/storefront-miniapp/tsconfig.json --noEmit`.
- Run `npm run build:weapp` in `apps/storefront-miniapp`.
- Confirm standalone miniapp typecheck no longer fails on the side-effect SCSS import in `src/app.tsx`.

## D. phase conclusion

- Phase 8K resolves the remaining standalone miniapp style-import typecheck blocker with one narrow local declaration seam while preserving the current miniapp build behavior.
