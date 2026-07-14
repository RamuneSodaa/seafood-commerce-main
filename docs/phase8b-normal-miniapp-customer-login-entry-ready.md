## A. what was added

- Added one normal miniapp customer login page at `pages/customer-login/index`.
- Reused the existing real auth exchange flow: `Taro.login()` -> `/auth/exchange-real` -> `authArtifact` storage -> existing login-success pipeline.
- Verified the stored `authArtifact` through the existing backend verify route before continuing.
- Added minimal non-dev navigation from the product list so customers can enter the real authenticated commerce path without using a dev page.

## B. what was intentionally not implemented

- No auth architecture redesign.
- No payment changes.
- No refund, reconciliation, or admin tooling work.
- No broad miniapp navigation refactor.
- No cleanup of existing dev-only pages in this phase.

## C. how to verify

- Open the miniapp product list and tap `顾客登录`.
- Complete the login flow and confirm the page stores the signed `authArtifact` and returns to the normal customer path.
- After login, open protected customer pages such as orders or checkout and confirm they use the existing authenticated flow.
- Run `npm run build:weapp` in `apps/storefront-miniapp`.
- Optionally run `npx tsc -p apps/storefront-miniapp/tsconfig.json --noEmit` and treat unrelated pre-existing dev-page parse failures as non-Phase-8B issues if they remain.

## D. phase conclusion

- Phase 8B replaces the dev-only real auth entry dependency with one small normal customer login entry while preserving the existing auth artifact storage and protected commerce path.
