## A. what was added

- Updated `apps/storefront-miniapp/tsconfig.json` to exclude the three remaining dev-only miniapp page files from the normal standalone typecheck surface.
- Kept the normal customer-facing miniapp source files inside the standalone typecheck surface.

## B. what was intentionally not implemented

- No file deletion.
- No auth changes.
- No payment changes.
- No broader tsconfig refactor.

## C. how to verify

- Run `npx tsc -p apps/storefront-miniapp/tsconfig.json --noEmit`.
- Run `npm run build:weapp` in `apps/storefront-miniapp`.
- Confirm the excluded files remain in the repo but no longer block the normal standalone miniapp typecheck.

## D. phase conclusion

- Phase 8G isolates the remaining dev-only miniapp files from standalone typecheck without weakening the normal customer-facing engineering surface.
