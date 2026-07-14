# Phase 2.23B Clean Baseline SQL 审查

审查对象：

`docs/migration_drafts/phase2_23b_clean_baseline_empty_db/migration.clean_baseline_empty_db.sql`

该 SQL 是从当前 `prisma/schema.prisma` 生成的空库 clean baseline 草案，只用于人工审查和下一阶段空库演练准备。本阶段未执行该 SQL。

## 危险语句检查

已检查以下危险语句：

- `DROP TABLE`
- `DROP COLUMN`
- `TRUNCATE`
- `DELETE FROM`
- `ALTER TABLE ... DROP`
- `DROP TYPE`
- `DROP INDEX`

当前结果：未发现上述危险语句。

## 主要 SQL 类型

该 SQL 主要包含：

- `CREATE SCHEMA`
- `CREATE TYPE`
- `CREATE TABLE`
- `CREATE INDEX`
- `CREATE UNIQUE INDEX`
- `ALTER TABLE ... ADD CONSTRAINT`

符合空库建表 baseline 预期。

## 是否包含候选版关键模型

已覆盖：

- 商品/门店/库存：`Product`、`Sku`、`Store`、`Inventory`、`StoreSkuAvailability`、`InventoryLog`
- 顾客相关：`CustomerAddress`，以及以 `customerId` 字符串关联的订单、购物车、会员、优惠券记录
- 购物车：`Cart`、`CartItem`
- 订单：`Order`、`OrderItem`、`OrderStatusLog`、`PaymentRecord`、`PickupRecord`、`Shipment`、`OrderShippingAddressSnapshot`
- 优惠券：`CouponTemplate`、`UserCoupon`、`CouponGrantLog`、`CouponRedemptionLog`、`OrderCouponApplication`
- 会员：`MemberProfile`、`SkuMemberPrice`
- 邀请：`ReferralRelation`、`ReferralReward`、`ReferralEvent`
- 后台：`AdminUser`，以及 `InventoryLog`、`OrderStatusLog` 中的 admin 操作人关联字段

注意：当前 schema 没有独立 `Customer` 表，顾客身份以 `customerId` 字符串贯穿购物车、订单、会员、优惠券等模型。这是当前候选版现状，不是本阶段变更。

## 关键索引和唯一约束

SQL 包含关键唯一约束：

- `Store.code`
- `Sku.code`
- `Cart.customerId`
- `CartItem.cartId + skuId`
- `StoreSkuAvailability.storeId + skuId`
- `Inventory.storeId + skuId`
- `Order.orderNo`
- `CouponTemplate.code`
- `OrderCouponApplication.orderId + userCouponId`
- `MemberProfile.customerId`
- `MemberProfile.inviteCode`
- `SkuMemberPrice.skuId + memberLevel`
- `ReferralRelation.referredCustomerId`
- `PaymentRecord.paymentRef`
- `AdminUser.username`

SQL 也包含购物车、优惠券、会员、邀请、日志等查询需要的普通索引。

## 生产 seed 前置条件

空库执行 clean baseline 后，生产 seed 至少需要准备：

1. 正式门店。
2. 正式商品与 SKU。
3. 正式库存初始化策略。
4. 上线确认的优惠券模板。
5. 上线确认的会员价。
6. 生产管理员创建流程。

当前本地 seed 仍混合本地管理员、演示库存和 demo cleanup，不能直接作为生产 seed。

## Enum 风险

当前 enum 覆盖候选版需要的状态：

- 订单状态：待支付、已支付待备货、待取货、完成、待发货、已发货、已送达、已取消、售后。
- 优惠券状态：已领取、锁定、已使用、已过期、作废。
- 用券日志动作：锁定、使用、释放、作废。
- 会员等级当前只有 `DEFAULT`。
- 邀请状态覆盖绑定、满足、已奖励、作废。

风险点：

- 当前订单超时取消复用 `CANCELLED`，若正式运营需要区分用户取消和支付超时，建议后续通过 `OrderStatusLog.action` 或新增状态设计处理。
- 会员等级当前只有 `DEFAULT`，银卡/金卡仍是前端展示预留，不是数据库等级。

## 审查结论

该 clean baseline SQL 适合作为空库建库草案进入下一阶段临时空库/预发布空库演练。

它不能用于已有库，不能混入旧 migration 链，不能未经演练直接生产执行。
