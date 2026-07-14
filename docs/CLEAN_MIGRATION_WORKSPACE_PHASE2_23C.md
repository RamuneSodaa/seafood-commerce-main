# Phase 2.23C Clean Migration Workspace

阶段：Phase 2.23C_production_seed_split_and_clean_migration_workspace_prep

## Workspace 路径

`.release_migration_workspaces/phase2_23c_empty_db_clean_baseline/`

## Workspace 结构

```text
.release_migration_workspaces/phase2_23c_empty_db_clean_baseline/
  README.md
  prisma/
    schema.prisma
    migrations/
      20260614_clean_initial_release_candidate/
        migration.sql
```

## 来源

- `schema.prisma` 从当前 `prisma/schema.prisma` 复制。
- `migration.sql` 从 `docs/migration_drafts/phase2_23b_clean_baseline_empty_db/migration.clean_baseline_empty_db.sql` 复制。

## 与 active migrations 的区别

当前 active `prisma/migrations` 仍保持旧历史目录不变。

本 workspace 是隔离目录：

- 不属于 active `prisma/migrations`。
- 不会被当前项目的 Prisma 自动执行。
- 不影响本地开发库。
- 不影响旧 migrations。

## 为什么不能直接使用当前旧 active migrations 上生产

当前旧 active migrations 可能没有覆盖后续通过 `prisma db push` 加入的优惠券、会员、邀请、订单多券应用等 schema。

如果直接用旧 migration 链上空库，可能出现：

- 数据库结构缺少当前候选版需要的表。
- API 启动或查询失败。
- 优惠券/会员/邀请功能不可用。

## 为什么不能把 clean baseline 混进旧 migration 链

clean baseline 是从空库创建完整当前 schema 的 SQL。如果放在旧 migration 链后面执行，会重复创建旧 migration 已经创建过的表、enum、索引，导致部署失败。

## 下一阶段如何演练

Phase 2.23D 建议：

1. 创建临时空库。
2. 使用本 workspace 执行 clean baseline migration。
3. 执行 production seed dry-run。
4. 在临时空库 apply production seed 候选。
5. 启动 API。
6. 运行顾客端核心接口 smoke test。
7. 销毁临时空库。

不允许连接生产库，不允许执行正式上线迁移。
