## A. what was added

- Hardened protected miniapp customer pages to redirect into the normal `pages/customer-login/index` entry when real-auth storage is missing.
- Preserved return-path behavior by sending the attempted protected page URL through the existing `redirect` query.
- Added one small shared redirect helper for protected customer pages.
- Updated the customer login page to safely decode the redirect target before returning the user to the protected flow.

## B. what was intentionally not implemented

- No auth architecture redesign.
- No payment or callback changes.
- No broad navigation refactor.
- No cleanup of unrelated dev-only pages.

## C. how to verify

- Clear stored real-auth data, then open `orders`, `order-detail`, or protected `checkout`.
- Confirm the page redirects to `pages/customer-login/index` instead of showing a raw missing-artifact error.
- Complete login and confirm the miniapp returns to the original protected page.
- Run `npm run build:weapp` in `apps/storefront-miniapp`.
- Optionally run `npx tsc -p apps/storefront-miniapp/tsconfig.json --noEmit` and treat unrelated pre-existing dev-page parse failures as non-Phase-8C issues if they remain.

## D. phase conclusion

- Phase 8C replaces raw missing-auth customer-facing failures on the main protected miniapp pages with a small redirect into the normal login entry while preserving the protected commerce return path.
