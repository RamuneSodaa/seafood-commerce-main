# Phase 2.23D 临时空库迁移与 seed apply 冒烟结果

生成时间：2026-06-14 14:21:22 CST

## 结论

本阶段按 `temp-db-only / migration-rehearsal / smoke-test` 执行，只对明确命名的本地临时库写入，未连接生产库、准生产库，也未对当前开发库执行迁移或 seed 写入。

clean migration、production seed apply、API smoke test、Prisma validate、顾客端 build、API tsc 均完成。  
本轮发现 1 个 P1 风险：production marketing seed 在临时空库中创建了 4 个优惠券模板，但 `autoGrantOnNewUser=false`，因此新顾客访问会员/优惠券接口后没有自动获得新人券。这不影响 migration 执行成功，但会影响正式空库 seed 后的新人券体验，建议下一阶段修复 production marketing seed。

## 临时数据库

成功演练库：

```text
phase2_23d_dryrun_20260614_141948
```

连接摘要：

```text
host: 127.0.0.1
port: 5433
database: phase2_23d_dryrun_20260614_141948
username: exists
password: exists
```

安全确认：

```text
未使用生产库：PASS
未使用准生产库：PASS
未对当前开发库 seafood_phase1 写入：PASS
临时库名称包含 phase2_23d_dryrun：PASS
执行前 public base table count = 0：PASS
完整 DATABASE_URL 未写入日志或 review pack：PASS
```

前置修正记录：

```text
第一次尝试：应用数据库用户无 CREATE DATABASE 权限，未创建临时库。
第二次尝试：使用 postgres 创建临时库但 owner 不是应用用户，migration 因 public schema 权限失败，未执行 seed。
第三次尝试：使用 postgres 创建临时库，并指定 owner 为应用数据库用户，migration 与 seed 成功。
```

第二次尝试创建的临时 dry-run 空库也保留供排查，未写入业务数据。未删除任何数据库。

## Migration

使用 workspace：

```text
.release_migration_workspaces/phase2_23c_empty_db_clean_baseline/prisma/schema.prisma
```

执行命令（脱敏）：

```bash
DATABASE_URL=<TEMP_DB_URL> npx prisma migrate deploy \
  --schema .release_migration_workspaces/phase2_23c_empty_db_clean_baseline/prisma/schema.prisma
```

结果：

```text
clean migration deploy: PASS
applied migration: 20260614_clean_initial_release_candidate
base table count: 28
enum count: 14
_prisma_migrations exists: true
```

关键表检查：

```text
Product: exists
Sku: exists
Store: exists
Inventory: exists
StoreSkuAvailability: exists
Cart: exists
Order: exists
OrderItem: exists
CouponTemplate: exists
UserCoupon: exists
OrderCouponApplication: exists
MemberProfile: exists
SkuMemberPrice: exists
ReferralRelation: exists
AdminUser: exists
Customer: not present by current schema design
```

说明：当前 schema 没有独立 `Customer` 表，顾客身份以 `customerId` 字符串关联 `MemberProfile`、`Cart`、`Order`、`UserCoupon` 等表；因此 `Customer` 不存在不判定为 migration 失败。

## Production Seed Apply

执行顺序：

```text
stores -> products -> inventory -> marketing -> admin bootstrap
```

执行结果：

```text
stores apply: PASS
products apply with --allow-candidate-products: PASS
inventory apply with --allow-candidate-inventory: PASS
marketing apply with --allow-pending-marketing: PASS
admin bootstrap apply with temporary admin: PASS
```

临时管理员：

```text
username: phase2_23d_admin_20260614_141948
displayName: 临时演练管理员
password logged: false
ADMIN_AUTH_SECRET logged: false
```

临时管理员未使用本地默认账号 `admin / <legacy-local-password-removed>`。

Seed 后数量：

```text
stores: 6
products: 3
skus: 6
storeSkuAvailability: 6
inventory: 6
couponTemplates: 4
skuMemberPrices: 6
adminUsers: 1
```

## API Smoke Test

API 指向临时库启动在：

```text
http://127.0.0.1:3010
```

说明：本机 3000 端口已有服务占用，本阶段未修改 API 源码，使用临时 bootstrap 在 3010 启动 Nest App。

接口结果：

```text
GET /products: 200 PASS，返回 3 个商品，含 SKU
GET /stores?skuId=<skuId>: 200 PASS，返回可售门店
GET /stores: 200 PASS，返回 6 个门店
GET /members/me: 200 PASS，会员档案可创建/读取
GET /coupons/my: 200 PASS，但返回 0 张券
GET /coupons/available: 200 PASS，但返回 0 张可用券
POST /cart/items: 201 PASS
GET /cart: 200 PASS
PATCH /cart/items/:id: 200 PASS
DELETE /cart/items/:id: 200 PASS
POST /orders/quote-preview/authenticated: 201 PASS
POST /orders/authenticated: 201 PASS，创建待支付订单
GET /orders/:id/authenticated: 200 PASS
POST /orders/:id/reorder-preview/authenticated: 201 PASS
POST /orders/:id/cancel/authenticated: 201 PASS
取消后 GET /orders/:id/authenticated: 200 PASS
```

支付相关：

```text
未调用真实微信支付。
未调用支付回调。
仅验证未支付订单保持待支付，且可取消。
```

取消后券状态：

```text
CLAIMED: 0
LOCKED: 0
USED: 0
```

原因：本轮临时空库中新人券没有自动发放，因此该订单未使用优惠券。

## P1 风险：新人券自动发放未被 production seed 激活

只读检查 `CouponTemplate`：

```text
NEW_USER_1000: autoGrantOnNewUser=false, perUserLimit=1, priority=0
NEW_USER_500: autoGrantOnNewUser=false, perUserLimit=1, priority=0
REFERRAL_INVITEE_1000: autoGrantOnNewUser=false, perUserLimit=1, priority=0
REFERRAL_INVITER_1500: autoGrantOnNewUser=false, perUserLimit=1, priority=0
```

影响：

```text
会员档案创建成功，但 ensureNewUserBenefits 找不到 autoGrantOnNewUser=true 的模板。
新顾客不会自动获得新人满减券/新客立减券。
checkout 无法显示新人券。
优惠券锁定/释放主链路本身未在本轮自动发券场景中覆盖。
```

建议：

```text
下一阶段优先修复 production marketing seed：
1. NEW_USER_1000 / NEW_USER_500 应设置 autoGrantOnNewUser=true。
2. 按现有业务需要设置 priority。
3. 重新对临时空库执行 migration + seed + API smoke。
```

## 验证命令

```bash
npx prisma validate --schema prisma/schema.prisma
npx prisma validate --schema .release_migration_workspaces/phase2_23c_empty_db_clean_baseline/prisma/schema.prisma
npm run build:weapp -w @seafood/storefront-miniapp
npx tsc --noEmit -p apps/api/tsconfig.json
```

结果：

```text
active prisma validate: PASS
workspace prisma validate: PASS
storefront-miniapp build: PASS
api tsc: PASS
```

## 问题分级

```text
P0: 0
P1: 1
P2: 0
P3: 0
```

P1：

```text
production marketing seed 未设置新人券自动发放字段，导致临时空库中新用户不会自动获得新人券。
```

## 阶段边界确认

```text
是否修改业务代码：否
是否修改 schema：否
是否执行生产/准生产迁移：否
是否写入当前开发库：否
是否调用真实微信支付：否
是否自动部署/发布：否
```

## 下一阶段建议

建议进入：

```text
Phase 2.23E_production_marketing_seed_autogrant_fix_and_temp_db_rerun
```

目标：

```text
只修 production marketing seed 的 autoGrantOnNewUser / priority 等字段；
不改 schema；
不改支付；
重新执行 Phase 2.23D 的临时空库 migration + seed + API smoke；
确认新用户自动发券、checkout 可见新人券、下单锁券和取消释放券在 production seed 场景中通过。
```
