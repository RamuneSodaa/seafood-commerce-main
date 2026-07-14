## A. Current state

- CLI engineering checks for the miniapp are now clean enough on the repo side:
  - standalone `npx tsc -p apps/storefront-miniapp/tsconfig.json --noEmit` passes
  - `npm run build:weapp` in `apps/storefront-miniapp` passes
- The miniapp project declares `typescript: "^6.0.2"` in `apps/storefront-miniapp/package.json`.
- `apps/storefront-miniapp/tsconfig.json` now contains `ignoreDeprecations: "6.0"` together with the current miniapp compiler settings.
- The remaining report is IDE-only: `Invalid value for '--ignoreDeprecations'.`
- This is different from actual repo compilation blockers because the CLI compiler accepts the config and completes successfully, while the warning appears only in editor diagnostics.

## B. Why current state is not yet perfectly clean developer experience

- The build/runtime path is clean.
- Standalone CLI typecheck is clean.
- But IDE consistency is still unclear, so developers may still see a misleading TypeScript error even though the repo’s actual miniapp checks pass.

## C. Smallest hardening target

- Classify the remaining issue as a likely IDE-vs-CLI TypeScript version consistency problem unless a repo-local editor setting proves otherwise.
- If a repo change is needed, keep it to one minimal workspace/editor guidance or config seam that helps the IDE use the same TypeScript version as the passing CLI path.
- Keep the next step smaller than any broad tooling rework.

## D. Explicitly out of scope

- auth redesign
- payment changes
- refunds
- reconciliation
- broad repo cleanup
- broad tooling overhaul

## E. Single smallest next code or workspace task

- Add one minimal repo-local editor setting that points the workspace TypeScript service at the project TypeScript SDK used by the passing miniapp CLI path, if and only if that is confirmed to remove the IDE-only `ignoreDeprecations` diagnostic without affecting repo compilation behavior.
