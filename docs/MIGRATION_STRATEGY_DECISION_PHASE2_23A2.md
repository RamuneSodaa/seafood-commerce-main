# Phase 2.23A2 正式迁移策略建议

阶段：Phase 2.23A2_migration_draft_quarantine_and_history_reconciliation

## 当前判断

当前项目同时存在历史 migrations 和一份从空库生成的 review-only full initial SQL。full initial SQL 已移到 `docs/migration_drafts/`，不再位于 active `prisma/migrations`。

正式上线前必须先确定目标数据库状态，再选择迁移策略。

## 方案 A：生产库为空库 / 新库

适用条件：

- 生产数据库是全新空库。
- 没有旧表、旧订单、旧库存、旧会员、旧优惠券等历史数据。

建议：

1. 可以考虑创建一套干净 migration 基线。
2. 不能直接把 review-only full initial migration 混在旧 migration 链后面。
3. 需要决定是否 squash migration。
4. 如果 squash，需要在单独分支或明确流程中处理旧 migrations。
5. 需要预发布空库演练。
6. 需要正式 seed 拆分后再执行。

推荐流程：

1. 锁定当前 schema 和代码版本。
2. 在专门分支生成干净 initial migration。
3. 人工审查 SQL。
4. 在预发布空库执行。
5. 执行生产 seed 的候选版本。
6. 跑顾客端核心回归和后台基础回归。
7. 再决定是否用于正式生产。

注意：review-only SQL 可以作为审查参考，但不能直接作为混入旧 migration 链的可部署迁移。

## 方案 B：生产库已有数据

适用条件：

- 生产库已经存在表或数据。
- 曾经跑过旧 schema。
- 需要保留历史商品、订单、库存、会员、优惠券等数据。

要求：

1. 不能使用 full initial migration。
2. 必须备份当前库。
3. 必须从当前数据库状态生成 diff。
4. 必须审查唯一约束、外键、NOT NULL、新 enum、历史脏数据。
5. 必须在预发布库用生产备份演练。
6. 必须准备回滚。

推荐流程：

1. 只读导出现有生产 schema。
2. 对比当前 `prisma/schema.prisma`。
3. 生成 current-db-to-schema migration 草案。
4. 人工审查是否包含危险 SQL。
5. 对历史数据做重复、孤儿、空值检查。
6. 先在预发布库执行。
7. 通过后再进入生产维护窗口。

## 推荐决策

如果项目尚未正式上线且没有生产数据，优先选择方案 A：新库干净基线。

如果已经存在任何真实订单、真实会员、真实库存、真实券数据，必须选择方案 B：已有库差异迁移。

## 不建议做的事

- 不建议继续用 `prisma db push` 上线。
- 不建议把 full initial review-only SQL 放回 active migrations。
- 不建议在没有预发布演练的情况下执行生产迁移。
- 不建议用本地演示 seed 直接初始化生产库。
