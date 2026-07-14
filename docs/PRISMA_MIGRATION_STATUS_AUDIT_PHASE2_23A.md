# Phase 2.23A Prisma 迁移现状审计

生成时间：2026-06-14  
阶段：Phase 2.23A_prisma_migration_draft_and_sql_review

## 审计结论

当前仓库内存在 `prisma/migrations` 目录，并已有多段本地迁移文件：

- `20260407120000_init`
- `20260408103000_add_customer_addresses`
- `20260408153000_add_product_cover_image`
- `20260408190000_add_order_pricing_snapshot_fields`
- `20260613135000_add_product_category_and_cart`
- `20260613172000_add_admin_auth_and_audit`

本阶段又新增一份只供人工审查的 initial SQL 草案：

- `20260614_phase2_23a_initial_release_candidate_schema`

这些文件说明项目已经有本地迁移草案/历史，但不能自动等同于“已完成生产迁移基线”。正式上线前仍需要人工确认：

1. 当前 `prisma/migrations` 是否与真实目标数据库状态一致。
2. 是否存在曾经使用 `prisma db push` 造成的本地库与迁移历史不完全一致问题。
3. 是否需要为生产库重新生成 from-current-db-to-schema 的差异迁移。
4. 是否需要在预发布库完整演练。

## Datasource

`prisma/schema.prisma` 当前 datasource：

- provider：`postgresql`
- url：`env("DATABASE_URL")`

本阶段没有输出、复制或打包 `DATABASE_URL` 原文。

## Schema 规模

当前 schema 统计：

- model 数量：27
- enum 数量：14

主要模型：

- 门店/商品/库存：`Store`、`Product`、`Sku`、`StoreSkuAvailability`、`Inventory`、`InventoryLog`
- 购物车：`Cart`、`CartItem`
- 订单：`Order`、`OrderItem`、`OrderStatusLog`、`PaymentRecord`、`PickupRecord`、`Shipment`、`OrderShippingAddressSnapshot`
- 优惠券：`CouponTemplate`、`UserCoupon`、`CouponGrantLog`、`CouponRedemptionLog`、`OrderCouponApplication`
- 会员/邀请：`MemberProfile`、`SkuMemberPrice`、`ReferralRelation`、`ReferralReward`、`ReferralEvent`
- 后台权限：`AdminUser`
- 地址：`CustomerAddress`

主要 enum：

- `FulfillmentType`
- `OrderStatus`
- `AdminRole`
- `CouponDiscountType`
- `CouponTemplateStatus`
- `CouponScene`
- `UserCouponStatus`
- `CouponGrantReason`
- `CouponRedemptionAction`
- `MemberLevel`
- `ReferralRelationStatus`
- `ReferralRewardType`
- `ReferralRewardStatus`
- `ReferralEventType`

## 关键关系

- `Sku` 归属 `Product`。
- `Inventory` 关联 `Store` 与 `Sku`，并通过唯一约束限制一个门店一个 SKU 一条库存记录。
- `Order` 关联 `Store`，订单明细关联 `Sku`。
- `CartItem` 关联 `Cart` 与 `Sku`，同一购物车同一 SKU 唯一。
- `UserCoupon` 关联 `CouponTemplate`，订单用券通过 `OrderCouponApplication` 记录。
- `CouponGrantLog`、`CouponRedemptionLog` 记录发券和用券生命周期。
- `SkuMemberPrice` 记录 SKU 会员价。
- `ReferralRelation`、`ReferralReward`、`ReferralEvent` 支撑邀请返券闭环。
- `AdminUser` 可关联 `Store`，用于 STORE_STAFF 门店隔离。

## db push 风险说明

本地开发阶段曾使用 `prisma db push` 来快速同步 schema。`db push` 对本地开发很方便，但不适合作为生产上线迁移方式，原因是：

1. 它不是可审查的版本化 SQL 迁移流程。
2. 它可能直接改变数据库结构，缺少生产前人工 SQL 审核。
3. 它不天然记录每一步变更意图和回滚策略。
4. 对已有生产数据时，字段、唯一约束、外键、enum 变化都需要单独评估。

## 为什么正式上线不能直接使用 db push

正式环境必须使用可审查、可回放、可备份、可演练的迁移流程。建议使用：

1. 生成 migration SQL。
2. 人工审查 SQL。
3. 先在预发布库演练。
4. 再在生产维护窗口执行。
5. 执行后做结构、索引、基础数据、核心链路验证。

## 本阶段执行边界

- 是否连接生产库：否
- 是否执行 `prisma migrate deploy`：否
- 是否执行任何数据库迁移：否
- 是否执行 reset/drop/delete/truncate：否
- 是否修改 schema：否
- 是否修改业务代码：否

本阶段只生成并审查 SQL 草案，不应用到任何数据库。
