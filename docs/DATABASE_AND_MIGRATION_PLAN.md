# 数据库与正式 Migration 计划

阶段：Phase 2.22A  
性质：plan-only，不在本阶段生成 migration。

## 当前重要模型梳理

| 模型/字段 | 用途 | 上线关注点 |
| --- | --- | --- |
| `Product.category / sortOrder / isRecommended` | 分类、排序、首页推荐 | 需要正式 migration 和后台维护入口 |
| `Sku.memberPrices -> SkuMemberPrice` | SKU 会员价 | 价格变更需审计 |
| `Cart / CartItem` | 后端持久化购物车 | customerId 绑定、库存校验 |
| `CouponTemplate` | 优惠券模板 | 新人券、邀请券、叠加规则、有效期 |
| `UserCoupon` | 用户券 | CLAIMED/LOCKED/USED/EXPIRED 状态 |
| `CouponGrantLog` | 发券日志 | 自动发券、邀请奖励、后台发券审计 |
| `CouponRedemptionLog` | 锁券/用券/释放日志 | LOCK/USE/RELEASE 可追踪 |
| `MemberProfile` | 会员档案 | inviteCode、会员等级、是否会员 |
| `ReferralRelation` | 邀请关系 | 一人只能绑定一个邀请人 |
| `ReferralReward` | 邀请奖励 | 首单完成后奖励券 |
| `ReferralEvent` | 邀请事件 | 分享/绑定/奖励过程记录 |
| `Order.memberDiscountAmountCents` | 会员优惠金额 | 订单快照 |
| `Order.couponDiscountAmountCents` | 优惠券优惠金额 | 订单快照 |
| `Order.discountAmountCents` | 总优惠金额 | 会员+券合计 |
| `OrderCouponApplication` | 订单使用的多张券 | 订单详情展示和用券追踪 |
| `InventoryLog` | 库存操作日志 | 后台操作审计 |
| `OrderStatusLog` | 订单状态日志 | 订单状态流转审计 |

## 当前风险

本地开发过程中曾使用 `prisma db push` 同步 schema。`db push` 适合本地开发快速验证，但不能替代正式生产 migration。

正式上线前必须：

1. 冻结当前 schema。
2. 生成正式 migration。
3. 人工审查 migration SQL。
4. 在备份后的预发布数据库演练。
5. 验证旧数据兼容和种子数据幂等。
6. 记录回滚方案。

## 推荐正式 migration 流程

1. 建立 git 版本基线或完整代码备份。
2. 确认 `DATABASE_URL` 指向预发布数据库，不是生产库。
3. 从当前 schema 生成 migration。
4. 人工审查 SQL：
   - 是否 drop/rename 表或列。
   - 是否会清空数据。
   - 新增 NOT NULL 字段是否有默认值。
   - 索引和唯一约束是否会因历史数据失败。
5. 在预发布库执行 migration。
6. 执行 seed 的幂等部分，避免重复脏数据。
7. 跑顾客端测试矩阵和后台关键操作。
8. 确认备份与回滚方案后再安排生产窗口。

## 本阶段不做

- 不生成 migration。
- 不执行 reset/drop/delete/truncate。
- 不清理真实订单、商品、门店、库存、会员或优惠券数据。

