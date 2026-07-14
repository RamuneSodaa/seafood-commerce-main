# Phase 2.23A2 Prisma Migration 历史复核

阶段：Phase 2.23A2_migration_draft_quarantine_and_history_reconciliation  
日期：2026-06-14

## 当前 active migrations

当前 `prisma/migrations` 目录下保留的 active migration 目录为：

- `20260407120000_init`
- `20260408103000_add_customer_addresses`
- `20260408153000_add_product_cover_image`
- `20260408190000_add_order_pricing_snapshot_fields`
- `20260613135000_add_product_category_and_cart`
- `20260613172000_add_admin_auth_and_audit`

Phase 2.23A 生成的 full initial review-only migration 已从 active migration 链中移出，并保留到：

`docs/migration_drafts/phase2_23a_initial_release_candidate_schema_review_only/migration.from_empty.review_only.sql`

## 为什么不能混放 full initial migration 和旧 migrations

full initial migration 是从空库一次性创建当前完整 schema 的 SQL。旧 migrations 是按历史步骤逐步创建/修改 schema 的 SQL。

如果把 full initial migration 放在旧 migration 链后面，未来执行 `prisma migrate deploy` 时可能出现：

1. 旧 migration 已经创建了表、enum、索引。
2. full initial migration 再次创建同名表、enum、索引。
3. 数据库报重复对象错误。
4. 生产部署失败，甚至卡在半执行状态。

因此，full initial SQL 只能作为 review-only 草案，不能和旧 migrations 混在 active `prisma/migrations` 目录里。

## 旧 migrations 覆盖风险

当前旧 migrations 中已经包含：

- 初始商品、门店、库存、订单等 Phase 1 结构。
- 顾客地址。
- 商品封面图字段。
- 订单价格快照字段。
- 商品分类与购物车。
- 管理员登录与部分操作审计字段。

但根据当前 `prisma/schema.prisma`，候选版还包含优惠券、会员、邀请、订单多券应用、会员价等较新的模型和字段。

从 active migration 文件名和内容看，旧 migrations 很可能没有完整覆盖最近通过 `prisma db push` 加入的以下结构：

- `CouponTemplate`
- `UserCoupon`
- `CouponGrantLog`
- `CouponRedemptionLog`
- `OrderCouponApplication`
- `MemberProfile`
- `SkuMemberPrice`
- `ReferralRelation`
- `ReferralReward`
- `ReferralEvent`
- 订单上的 `memberDiscountAmountCents`、`couponDiscountAmountCents`、`appliedUserCouponId`
- 部分待支付/锁券/邀请相关索引与约束

结论：当前 active migration 链不能直接视为完整生产迁移链。正式上线前必须重新确定迁移策略。

## 正式上线前二选一

### 方案 A：空库全新上线

如果目标生产库是新空库，可以考虑建立干净的 squashed initial migration 基线。

要求：

1. 不把 review-only full initial SQL 直接混入旧 migration 链。
2. 明确是否要 squash 历史 migrations。
3. 在单独分支或明确流程中处理旧 migrations。
4. 预发布空库完整演练。
5. 使用拆分后的生产 seed。

### 方案 B：已有库上线

如果目标生产库已有旧表或旧数据，不能使用 full initial migration。

要求：

1. 备份现有数据库。
2. 从当前数据库状态生成 diff。
3. 人工审查唯一约束、外键、NOT NULL、新 enum、历史脏数据。
4. 在预发布库使用生产备份演练。
5. 准备回滚方案。

## 本阶段执行边界

- 未修改业务代码。
- 未修改 `prisma/schema.prisma`。
- 未执行 `prisma migrate deploy`。
- 未连接生产数据库。
- 未执行 reset/drop/delete/truncate。
- 只隔离 review-only SQL 并整理迁移策略。
