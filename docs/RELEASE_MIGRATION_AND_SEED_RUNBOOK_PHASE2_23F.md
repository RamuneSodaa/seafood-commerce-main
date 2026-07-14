# Phase 2.23F 正式 Migration + Seed Runbook

阶段：Phase 2.23F  
性质：runbook-freeze / docs-only  
生成时间：2026-06-14

本 runbook 固化 Phase 2.23D / 2.23E 已在本地临时空库验证通过的 clean migration、production seed apply 和核心 API smoke test 路径。本文不是生产执行记录，不包含任何真实 `DATABASE_URL`、密码、证书、私钥或支付密钥。

## 1. 当前推荐上线数据库路径

### A. 生产库为空库 / 全新库

当前项目建议优先走空库新上线，前提是确认没有真实生产数据需要迁移。

推荐路径：

1. 准备一个全新生产数据库。
2. 使用 clean migration baseline 执行建表。
3. 按生产 seed 顺序写入门店、商品、库存、营销模板和管理员。
4. 执行 seed 后数据校验。
5. 执行顾客端核心 API smoke test。
6. 再进入微信支付准正式/真机专项验收。

注意：即使为空库，也不要用 `prisma db push` 上生产；应使用人工审查过的 migration 链。

### B. 生产库已有真实数据

如果生产库已经有真实表或真实数据，不能直接使用 clean baseline。

必须改走：

1. 备份现有数据库。
2. 只读导出现有 schema。
3. 生成 current-db-to-schema diff。
4. 人工审查差异 SQL。
5. 准生产库演练。
6. 准备数据修复和回滚方案。
7. 再安排生产窗口执行。

禁止把 clean baseline 直接套到已有真实数据的库上。

## 2. Clean Migration 来源

clean baseline workspace：

```text
.release_migration_workspaces/phase2_23c_empty_db_clean_baseline/
```

schema：

```text
.release_migration_workspaces/phase2_23c_empty_db_clean_baseline/prisma/schema.prisma
```

migration：

```text
.release_migration_workspaces/phase2_23c_empty_db_clean_baseline/prisma/migrations/20260614_clean_initial_release_candidate/migration.sql
```

Phase 2.23D / 2.23E 已验证：

```text
临时空库 migrate deploy: PASS
base table count: 28
enum count: 14
_prisma_migrations exists: true
```

## 3. Active Migrations 边界

当前项目 active `prisma/migrations` 仍保留旧 6 个目录。clean baseline 没有混回 active migrations。

上线前必须明确选择一种 release 策略：

1. 新库上线：使用 clean baseline workspace。
2. 已有库上线：使用 existing-db diff。

禁止事项：

```text
不允许把 review-only SQL 混到旧 migration 链后面。
不允许把 clean baseline 和旧 active migration 链混用。
不允许未经人工审查直接 migrate deploy 到生产。
不允许生产使用 prisma db push。
```

## 4. Production Seed 顺序

生产 seed 必须按以下顺序执行：

```text
stores -> products -> inventory -> marketing -> admin bootstrap
```

原因：

1. 商品和库存依赖门店。
2. 库存依赖门店和 SKU。
3. 会员价依赖 SKU。
4. 管理员最后创建，避免 seed 中途失败后留下误判为可运营的后台账号。

## 5. Production Seed 命令模板

以下命令只写模板，不包含真实连接串、密码、secret。

```bash
DATABASE_URL="<PRODUCTION_DATABASE_URL>" \
npm run seed:prod:stores:apply -w @seafood/api
```

```bash
DATABASE_URL="<PRODUCTION_DATABASE_URL>" \
npm run seed:prod:products:apply -w @seafood/api -- --allow-candidate-products
```

```bash
DATABASE_URL="<PRODUCTION_DATABASE_URL>" \
npm run seed:prod:inventory:apply -w @seafood/api -- --allow-candidate-inventory
```

```bash
DATABASE_URL="<PRODUCTION_DATABASE_URL>" \
npm run seed:prod:marketing:apply -w @seafood/api -- --allow-pending-marketing
```

```bash
PRODUCTION_ADMIN_USERNAME="<SECURE_ADMIN_USERNAME>" \
PRODUCTION_ADMIN_PASSWORD="<SECURE_ADMIN_PASSWORD>" \
PRODUCTION_ADMIN_DISPLAY_NAME="<ADMIN_DISPLAY_NAME>" \
ADMIN_AUTH_SECRET="<SECURE_ADMIN_AUTH_SECRET>" \
DATABASE_URL="<PRODUCTION_DATABASE_URL>" \
npm run seed:prod:admin-bootstrap:apply -w @seafood/api
```

上线前注意：

```text
products apply 带 --allow-candidate-products，直到真实商品确认。
inventory apply 带 --allow-candidate-inventory，直到真实库存确认。
marketing apply 带 --allow-pending-marketing，直到优惠券策略确认。
admin bootstrap 禁止使用 admin / <legacy-local-password-removed>。
```

## 6. Seed 后数量验证

Phase 2.23E 临时空库 seed 后结果：

```text
Store: 6
Product: 3
Sku: 6
StoreSkuAvailability: 6
Inventory: 6
CouponTemplate: 4
UserCoupon: 0
SkuMemberPrice: 6
AdminUser: 1
```

正式上线时应逐项复核：

```text
Store 数量符合正式门店。
Product 数量符合正式商品。
Sku 数量符合正式规格。
Inventory 数量符合门店/SKU 库存关系。
StoreSkuAvailability 数量符合可售门店。
CouponTemplate 数量符合优惠券策略。
SkuMemberPrice 数量符合会员价策略。
AdminUser 至少有 1 个正式管理员。
初始 UserCoupon 应为 0。
新用户触发后应获得 NEW_USER_1000 和 NEW_USER_500。
```

## 7. 新人券 AutoGrant 必查

Phase 2.23E 已修复并通过临时空库复跑：

```text
NEW_USER_1000.autoGrantOnNewUser=true
NEW_USER_500.autoGrantOnNewUser=true
REFERRAL_INVITEE_1000.autoGrantOnNewUser=false
REFERRAL_INVITER_1500.autoGrantOnNewUser=false
```

必须继续检查：

```text
perUserLimit=1
重复触发不重复发券
普通新用户只自动获得新人券，不自动获得邀请奖励券
邀请奖励券由邀请流程触发，不由普通注册触发
```

## 8. 订单 / 优惠券核心 Smoke Test

上线前 seed 后必须跑以下 smoke test：

```text
GET /products 返回 3 款候选商品及 SKU
GET /stores 返回广州门店
GET /stores?skuId=<skuId> 返回可售门店
SKU 有可售库存
GET /members/me 创建/读取会员档案
GET /coupons/my 自动发放新人券
GET /coupons/available 可看到新人券
¥64 couponBase 场景下 NEW_USER_500 可用
¥64 couponBase 场景下 NEW_USER_1000 显示还差 ¥4.00
使用 NEW_USER_500 创建待支付订单
下单后 NEW_USER_500 变 LOCKED
订单详情展示优惠券金额
取消待支付订单
取消后 NEW_USER_500 回到 CLAIMED
POST /orders/:id/reorder-preview/authenticated 可重新校验当前商品、SKU、库存、价格
```

## 9. 支付专项前 Gate

进入 Phase 2.24A 前必须确认：

```text
clean migration + production seed 在临时空库复跑 PASS
新人券 autoGrant 复跑 PASS
顾客端 build PASS
API tsc PASS
active schema validate PASS
workspace schema validate PASS
未调用真实微信支付
P0/P1/P2/P3 = 0/0/0/0
```

## 10. 不在本阶段做的事

```text
不执行生产 migration
不执行生产 seed
不连接生产/准生产/开发库写入
不调用真实微信支付
不部署
不发布
不改支付核心逻辑
```

