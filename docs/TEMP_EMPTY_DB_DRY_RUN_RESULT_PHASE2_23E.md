# Phase 2.23E 新人券自动发放修复与临时空库复跑结果

生成时间：2026-06-14 14:28:43 CST

## 结论

本阶段只修复 production marketing seed 中新人券自动发放配置，未修改 schema、支付逻辑、顾客端 UI、后台页面或业务 API。

修复后重新创建新的本地临时空库，重新执行 clean migration、production seed apply、API smoke test。结果显示：

```text
clean migration: PASS
production seed apply: PASS
新人券 autoGrant 字段: PASS
新用户自动发券: PASS
重复触发不重复发券: PASS
checkout 可见新人券: PASS
下单锁券: PASS
取消释放券: PASS
真实微信支付调用: 未调用
P0/P1/P2/P3: 0 / 0 / 0 / 0
```

## 修改范围

修改文件：

```text
apps/api/prisma/seed.shared.ts
apps/api/prisma/seed.production.marketing.ts
docs/TEMP_EMPTY_DB_DRY_RUN_RESULT_PHASE2_23E.md
```

未修改：

```text
prisma/schema.prisma
支付核心逻辑
微信支付签名、商户号、证书、私钥、回调验签逻辑
顾客端 UI
后台页面
业务 API
```

## Seed 修复内容

`NEW_USER_1000`：

```text
autoGrantOnNewUser=true
perUserLimit=1
priority=90
满 68 减 10
canStack=true
```

`NEW_USER_500`：

```text
autoGrantOnNewUser=true
perUserLimit=1
priority=80
无门槛减 5
canStack=true
```

`REFERRAL_INVITEE_1000`：

```text
autoGrantOnNewUser=false
perUserLimit=1
priority=75
好友首单券，不给普通新用户自动发放
```

`REFERRAL_INVITER_1500`：

```text
autoGrantOnNewUser=false
perUserLimit=1
priority=70
邀请奖励券，仅应由被邀请人首单支付成功后发放给邀请人
```

## 临时数据库

本轮成功演练库：

```text
phase2_23e_dryrun_20260614_142714
```

连接摘要：

```text
host: 127.0.0.1
port: 5433
database: phase2_23e_dryrun_20260614_142714
username: exists
password: exists
```

安全确认：

```text
未连接生产库：PASS
未连接准生产库：PASS
未对当前开发库 seafood_phase1 写入：PASS
临时库名称包含 phase2_23e_dryrun：PASS
执行前 public base table count = 0：PASS
完整 DATABASE_URL 未写入日志或 review pack：PASS
```

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

## Production Seed Apply

执行顺序：

```text
stores -> products -> inventory -> marketing -> admin bootstrap
```

结果：

```text
stores apply: PASS
products apply with --allow-candidate-products: PASS
inventory apply with --allow-candidate-inventory: PASS
marketing apply with --allow-pending-marketing: PASS
admin bootstrap apply with temporary admin: PASS
```

临时管理员：

```text
username: phase2_23e_admin_20260614_142714
displayName: 临时演练管理员
password logged: false
ADMIN_AUTH_SECRET logged: false
```

Seed 后数量：

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

说明：`UserCoupon` 初始为 0 是预期状态，直到新顾客触发会员/优惠券逻辑后才自动发券。

## 券模板字段检查

```text
NEW_USER_1000: autoGrantOnNewUser=true, perUserLimit=1, priority=90
NEW_USER_500: autoGrantOnNewUser=true, perUserLimit=1, priority=80
REFERRAL_INVITEE_1000: autoGrantOnNewUser=false, perUserLimit=1, priority=75
REFERRAL_INVITER_1500: autoGrantOnNewUser=false, perUserLimit=1, priority=70
```

结果：PASS。

## API Smoke Test

临时 API：

```text
http://127.0.0.1:3010
```

说明：本机 3000 端口已有服务占用，本阶段未修改 API 源码，使用临时 bootstrap 在 3010 启动 Nest App。

基础数据：

```text
GET /products: 200 PASS，返回 3 个商品，含 SKU
GET /stores: 200 PASS，返回 6 个门店
GET /stores?skuId=<skuId>: 200 PASS，返回可售门店
```

新用户自动发券：

```text
GET /members/me: 200 PASS
GET /coupons/my: 200 PASS，返回 2 张券
自动获得券：NEW_USER_1000、NEW_USER_500
重复触发后券数量仍为 2：PASS
GET /coupons/available: 200 PASS，返回 2 张券
```

Checkout 金额与券：

```text
测试商品：海味汤料组合 标准装
商品原价：¥68.00
会员优惠后 couponBase：¥64.00
NEW_USER_500：可用，优惠 ¥5.00，应付 ¥59.00
NEW_USER_1000：未达满 ¥68 门槛，预期还差 ¥4.00
```

下单锁券：

```text
使用 NEW_USER_500 创建待支付订单：PASS
订单创建后券状态：
CLAIMED: 1
LOCKED: 1
USED: 0
lockedCodes: NEW_USER_500
```

取消释放券：

```text
取消待支付订单：PASS
取消后券状态：
CLAIMED: 2
LOCKED: 0
USED: 0
claimedCodes: NEW_USER_1000, NEW_USER_500
```

再来一单：

```text
POST /orders/:id/reorder-preview/authenticated: 201 PASS
```

支付相关：

```text
未调用真实微信支付。
未调用支付回调。
仅验证未支付订单、锁券、取消释放券。
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
P1: 0
P2: 0
P3: 0
```

## 阶段边界确认

```text
是否修改业务代码：是，仅 production seed 配置
是否修改 schema：否
是否连接生产/准生产库：否
是否写入当前开发库：否
是否调用真实微信支付：否
是否自动部署/发布：否
```

## 下一阶段建议

建议进入：

```text
Phase 2.23F_release_migration_seed_runbook_update
```

目标：

```text
把 Phase 2.23E 的 clean migration + production seed apply 成功路径写入正式 runbook；
补充 production marketing seed 的新人券自动发放验收项；
保持不部署、不发布、不连接生产库；
为后续准生产/正式数据库 migration 演练做人工 checklist。
```
