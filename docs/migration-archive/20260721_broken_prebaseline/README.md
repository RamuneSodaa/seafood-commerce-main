# Archived Prisma migration chain

This directory preserves the exact pre-baseline migration history that was active
before the 2026-07-21 production-baseline cutover.

Why archived:
- The chain mixed legacy lowercase/plural PostgreSQL table names with later
  quoted Prisma model table names.
- Multiple later ALTER TABLE statements targeted tables that had never been
  created under those exact names by the preceding migration history.
- The active chain covered only a subset of the current Prisma schema.

These files are historical evidence only and MUST NOT be moved back under
`prisma/migrations/` without a dedicated migration-history recovery plan.

No production data was deleted as part of this archive operation.
