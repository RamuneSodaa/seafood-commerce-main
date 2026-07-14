# Phase 2.23A Prisma Migration SQL 审查

审查对象：

`prisma/migrations/20260614_phase2_23a_initial_release_candidate_schema/migration.sql`

生成方式：

```bash
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
```

说明：该 SQL 是“从空库创建当前候选 schema”的 initial 草案，仅供人工审查与未来干净环境部署参考。本阶段未执行该 SQL。

## SQL 概览

- 总行数：682
- `CREATE TYPE`：14
- `CREATE TABLE`：27
- `CREATE INDEX`：30
- `CREATE UNIQUE INDEX`：18
- `ALTER TABLE ... ADD CONSTRAINT`：28

## 危险语句扫描

本次扫描以下危险语句：

- `DROP TABLE`
- `DROP COLUMN`
- `TRUNCATE`
- `DELETE FROM`
- `ALTER TABLE ... DROP`
- `DROP TYPE`
- `DROP INDEX`

扫描结果：未发现上述危险语句。

## 预期语句类型

SQL 主要包含：

- `CREATE SCHEMA`
- `CREATE TYPE`
- `CREATE TABLE`
- `CREATE INDEX`
- `CREATE UNIQUE INDEX`
- `ALTER TABLE ... ADD CONSTRAINT`

这些符合“空库初始化建表”场景预期。

## NOT NULL 字段风险

该 SQL 是从空库创建表，因此表内必填字段不会触发历史数据回填风险。

但如果目标数据库已经存在旧表或旧数据，不能直接套用这份 initial SQL。已有库需要重新生成从当前数据库状态到目标 schema 的差异 SQL，并重点审查新增 NOT NULL 字段是否有默认值或回填方案。

## 唯一约束风险

本 SQL 包含多个唯一约束，例如：

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

空库初始化没有历史重复数据风险。已有库迁移前必须先做重复数据检查，否则唯一索引创建可能失败。

## 外键顺序风险

SQL 先创建全部表和索引，再用 `ALTER TABLE ... ADD CONSTRAINT` 添加外键。该顺序适合空库初始化。

已有库迁移时需要额外检查历史孤儿数据，例如：

- `Sku.productId` 是否都指向存在的 `Product`
- `Order.storeId` 是否都指向存在的 `Store`
- `OrderItem.skuId` 是否都指向存在的 `Sku`
- `Inventory.storeId/skuId` 是否有效
- `UserCoupon.templateId` 是否有效
- `OrderCouponApplication` 关联是否有效

## Enum 与状态机一致性

本 SQL 包含以下 enum：

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

当前 enum 覆盖候选版需要的主要状态：

- 订单：待支付、已支付待备货、待取货、完成、待发货、已发货、已送达、已取消、售后。
- 优惠券：已领取、已锁定、已使用、已过期、作废。
- 用券日志：锁定、使用、释放、作废。
- 邀请：绑定、满足条件、已奖励、作废。

注意：当前订单超时取消复用 `CANCELLED` 状态，没有独立 `PAYMENT_EXPIRED` enum。正式上线前如果希望区分“用户取消”和“支付超时取消”，建议单独评估是否增加状态或通过 `OrderStatusLog.action/note` 区分。

## 候选版模型覆盖

该 SQL 覆盖当前候选版需要的核心模型：

- 商品、SKU、门店、库存
- 购物车
- 订单、订单明细、价格快照、支付记录、自提/发货记录
- 优惠券模板、用户券、发券日志、用券日志、多券订单应用
- 会员档案、SKU 会员价
- 邀请关系、邀请奖励、邀请事件
- 后台管理员与操作日志关联

## 空库上线适用性

如果生产数据库是完全空库，并且本 SQL 经人工审查通过，可以作为初始建库脚本的参考。

仍需注意：

1. 生产执行前必须先备份确认。
2. 生产执行不应直接使用本地 `.env` 或 `.local/env`。
3. 执行后必须跑正式 seed，而不是本地演示 seed。
4. 需要在预发布库完整演练。

## 已有库上线适用性

如果生产数据库已经有旧表或旧数据，不能直接套用该 initial migration。

已有库必须：

1. 备份当前数据库。
2. 导出现有 schema。
3. 生成 from-current-db-to-schema 的 diff。
4. 人工审查数据迁移和回填脚本。
5. 检查唯一约束和外键历史数据。
6. 在预发布库演练。
7. 准备回滚方案。

## 审查结论

该 `migration.sql` 没有发现删除性危险 SQL，结构上适合作为空库初始化草案继续人工审查。

它不是生产已批准迁移，也不能直接用于已有数据的生产库。
