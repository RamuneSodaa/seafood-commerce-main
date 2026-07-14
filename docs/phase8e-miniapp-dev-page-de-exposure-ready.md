## A. what was added

- Removed the three clearly dev-only miniapp pages from `apps/storefront-miniapp/src/app.config.ts`.
- Kept the normal non-dev customer MVP pages exposed in the miniapp page list.

## B. what was intentionally not implemented

- No file deletion.
- No auth redesign or auth flow changes.
- No payment changes.
- No broader dev-page cleanup.

## C. how to verify

- Open `apps/storefront-miniapp/src/app.config.ts` and confirm only the normal non-dev customer pages remain in the page list.
- Run `npm run build:weapp` in `apps/storefront-miniapp`.
- Optionally run `npx tsc -p apps/storefront-miniapp/tsconfig.json --noEmit` and treat any remaining dev-page parse failures as unrelated to this page-exposure-only change.

## D. phase conclusion

- Phase 8E removes the dev-only miniapp pages from shipped page exposure while keeping the normal customer MVP path intact.
