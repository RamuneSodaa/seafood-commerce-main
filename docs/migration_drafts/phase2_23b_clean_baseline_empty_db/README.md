# Phase 2.23B Clean Baseline Empty DB 草案

本目录用于保存“生产库为空库 / 新库”场景的 clean migration baseline 草案。

## 文件

- `migration.clean_baseline_empty_db.sql`
- `SQL_REVIEW.md`

## 重要说明

1. 这是 clean baseline 草案。
2. 只适合空库。
3. 不能用于已有库。
4. 不能和旧 migration 链混用。
5. 不能直接生产执行。
6. 下一阶段需要在临时空库或预发布空库演练。

## 与 active migrations 的关系

本目录不属于 active `prisma/migrations`。当前 SQL 不会被 Prisma 自动作为 migration 执行。

如果未来决定采用 clean baseline，需要在单独流程中建立正式 migration 基线，不应直接把本目录复制进旧 migration 链后面。

## 推荐下一步

进入 Phase 2.23C 前，先确认目标数据库是空库，并准备临时空库演练环境。
