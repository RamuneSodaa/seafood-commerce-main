## A. what was added

- Added one repo-local workspace editor setting pointing TypeScript SDK resolution at `apps/storefront-miniapp/node_modules/typescript/lib`.
- Kept repo compilation behavior and miniapp build behavior unchanged.

## B. what was intentionally not implemented

- No auth changes.
- No payment changes.
- No tsconfig rewrite.
- No broad editor customization.

## C. how to verify

- Run `npx tsc -p apps/storefront-miniapp/tsconfig.json --noEmit`.
- Run `npm run build:weapp` in `apps/storefront-miniapp`.
- Reload the editor window or restart the TypeScript server so the IDE picks up the new workspace SDK path, then re-check whether the IDE-only `ignoreDeprecations` diagnostic disappears.

## D. phase conclusion

- Phase 8M adds one narrow repo-local workspace alignment seam so the IDE can use the same TypeScript SDK path as the passing miniapp CLI checks.
