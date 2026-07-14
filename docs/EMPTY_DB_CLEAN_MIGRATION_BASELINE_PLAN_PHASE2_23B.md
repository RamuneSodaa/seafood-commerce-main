# Phase 2.23B 空库 Clean Migration Baseline 计划

阶段：Phase 2.23B_empty_db_clean_migration_baseline_plan  
日期：2026-06-14

## 本阶段结论

当前项目尚未正式上线，且人工判断优先按“生产库为空库 / 新库”的方向准备迁移策略。本阶段只做 clean migration baseline 方案和草案，不执行生产迁移，不连接生产数据库，不修改业务代码，不修改 `prisma/schema.prisma`。

## 为什么需要 clean baseline

当前 active `prisma/migrations` 目录中保留的是历史迁移：

- `20260407120000_init`
- `20260408103000_add_customer_addresses`
- `20260408153000_add_product_cover_image`
- `20260408190000_add_order_pricing_snapshot_fields`
- `20260613135000_add_product_category_and_cart`
- `20260613172000_add_admin_auth_and_audit`

这些旧 migrations 很可能没有完整覆盖当前候选版中后续通过 `prisma db push` 加入的结构，例如优惠券、会员、邀请、订单多券应用、部分会员价与锁券相关字段。

同时，Phase 2.23A 生成的 full initial SQL 是从空库到当前 schema 的完整草案，不能混入旧 migration 链，否则未来 `prisma migrate deploy` 可能先执行旧 migration，再执行 full initial SQL，导致重复创建表、enum、索引。

因此，正式空库上线需要一条干净、可演练、可审查的 migration 链，而不是混用旧 migrations 和 review-only full SQL。

## Clean baseline 推荐方式

建议方式：

1. 在单独 release 分支或单独迁移准备目录中建立干净 migration。
2. 不在当前 active `prisma/migrations` 中混入 review-only SQL。
3. 不直接删除旧 migrations，除非已经建立版本控制、完整备份，并明确切换策略。
4. 如果项目不是 git repo，必须先建立版本基线或完整备份。
5. 先在临时空库或预发布空库演练。
6. 演练通过后再决定是否把 clean baseline 作为正式迁移基线。

当前本阶段准备的草案目录为：

`docs/migration_drafts/phase2_23b_clean_baseline_empty_db/`

该目录只用于审查和下一阶段空库演练准备，不是 active Prisma migration 目录。

## 空库方案的前提

空库 clean baseline 只适用于以下情况：

1. 生产数据库确认为空库。
2. 没有真实订单、真实库存、真实会员、真实优惠券数据需要保留。
3. 没有已跑旧 migrations 的生产库。
4. 正式 seed 已拆分或准备拆分。
5. 已准备预发布空库演练环境。
6. 已准备正式支付、域名、环境变量和小程序发布验收计划。

## 空库方案不适用场景

以下情况不能使用 clean baseline 空库方案：

1. 已有真实生产数据。
2. 已经跑过旧 migrations 的生产库。
3. 有必须保留的历史订单、用户、库存、优惠券或会员数据。
4. 无法确认生产库是否为空。
5. 没有数据库备份和回滚策略。

这些场景必须改用“已有库 diff 迁移方案”。

## 当前建议

如果确认绿膳荟项目尚未正式上线、生产库尚未承载真实数据，建议下一阶段进入空库演练：

1. 建临时空库。
2. 执行 clean baseline 草案。
3. 执行生产 seed 候选。
4. 启动 API 和小程序。
5. 跑顾客端核心接口 smoke test。
6. 记录演练结果。

本阶段不执行上述演练，只提供计划和草案。
