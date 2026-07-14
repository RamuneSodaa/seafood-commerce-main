# Phase 2.23A Review-only Initial SQL 草案

这份 SQL 是从空库生成的 full initial schema 草案，仅用于人工审查当前 Prisma schema 的完整结构。

## 重要边界

1. 这是从空库生成的 full initial SQL 草案。
2. 仅用于人工审查当前 schema 全貌。
3. 不能和旧 migrations 一起放在 active `prisma/migrations` 下执行。
4. 不能直接用于已有库。
5. 不能直接生产 deploy。
6. 如果未来选择“squash migration / 空库全新上线”，必须单独建立干净 migration 基线，不能混用旧 migration 链。

## 当前用途

- SQL 文件：`migration.from_empty.review_only.sql`
- 用途：人工审查表、enum、索引、外键、约束。
- 禁止用途：直接 `prisma migrate deploy`、直接生产执行、混入旧 migration 链。

## 后续建议

- 空库新上线：单独设计干净 migration 基线，并在预发布空库演练。
- 已有库上线：从当前数据库状态生成 diff，不使用这份 full initial SQL。
