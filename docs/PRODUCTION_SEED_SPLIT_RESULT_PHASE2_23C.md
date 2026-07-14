# Phase 2.23C 生产 Seed 拆分结果

阶段：Phase 2.23C_production_seed_split_and_clean_migration_workspace_prep  
日期：2026-06-14

## 拆分结果

本阶段新增/调整 seed 文件：

- `apps/api/prisma/seed.ts`
- `apps/api/prisma/seed.local.ts`
- `apps/api/prisma/seed.shared.ts`
- `apps/api/prisma/seed.production.stores.ts`
- `apps/api/prisma/seed.production.products.ts`
- `apps/api/prisma/seed.production.inventory.ts`
- `apps/api/prisma/seed.production.marketing.ts`
- `apps/api/prisma/seed.production.admin.bootstrap.ts`

`seed.ts` 仍是 Prisma 默认 seed 入口，但只转发到 `seed.local.ts`，明确为本地开发入口。

## 文件用途

### seed.local.ts

用途：本地开发 seed。

允许包含：

- 本地管理员 `admin / <legacy-local-password-removed>`
- legacy 兼容逻辑
- 本地演示库存初始化
- demo cleanup
- 本地测试优惠券

禁止生产运行。

### seed.shared.ts

用途：生产 seed 与本地 seed 共享工具和候选数据。

包含：

- dry-run/apply 参数解析。
- 生产 apply 确认参数校验。
- 本地默认管理员拒绝逻辑。
- 安全日志工具。
- 生产门店候选。
- 生产商品候选。
- 生产库存候选。
- 生产营销候选。

### seed.production.stores.ts

用途：正式门店 seed 候选。

包含：

- 广州正式门店候选数据。

禁止：

- legacy 上海门店。
- 演示门店。
- 测试地址。

### seed.production.products.ts

用途：正式商品、SKU、价格、分类、上下架状态 seed 候选。

当前状态：

- 复用当前候选版三款干货海味商品。
- 全部标记为需要运营确认。
- apply 时如未传入 `--allow-candidate-products` 会拒绝写入。

禁止：

- 历史 demo 商品。
- “新鲜三文鱼”等测试数据。
- demo cleanup。

### seed.production.inventory.ts

用途：正式库存 seed 候选。

当前状态：

- 只给候选主门店和候选 SKU 准备少量演练库存。
- 全部标记为需要运营确认。
- apply 时如未传入 `--allow-candidate-inventory` 会拒绝写入。

禁止：

- 全部 SKU、全部门店默认 100。
- 演示库存进入正式生产。
- 未确认库存静默写入生产。

### seed.production.marketing.ts

用途：正式优惠券模板、会员价、邀请奖励券 seed 候选。

当前状态：

- 新人满减券、新客立减券、邀请奖励券等仍标记为需要运营确认。
- apply 时如未传入 `--allow-pending-marketing` 会拒绝写入。

禁止：

- 未确认但静默写入生产的营销规则。
- 密码、token、secret 输出。

### seed.production.admin.bootstrap.ts

用途：生产管理员安全 bootstrap。

要求：

- 需要 `PRODUCTION_ADMIN_USERNAME`
- 需要 `PRODUCTION_ADMIN_PASSWORD`
- 需要 `PRODUCTION_ADMIN_DISPLAY_NAME`
- apply 需要 `--confirm-production-admin-bootstrap`

明确拒绝：

- `admin`
- `<legacy-local-password-removed>`
- `<legacy-local-auth-secret-removed>`

不会输出密码、hash、token、secret。

## dry-run/apply 行为

所有 production seed 默认 dry-run，不写数据库。

只有显式 `--apply` 且满足确认参数时才会写入。

生产管理员 bootstrap 需要更强确认：

`--apply --confirm-production-admin-bootstrap`

## package scripts

根 package 新增：

- `seed:local`
- `seed:prod:stores:dry-run`
- `seed:prod:stores:apply`
- `seed:prod:products:dry-run`
- `seed:prod:products:apply`
- `seed:prod:inventory:dry-run`
- `seed:prod:inventory:apply`
- `seed:prod:marketing:dry-run`
- `seed:prod:marketing:apply`
- `seed:prod:admin-bootstrap:dry-run`
- `seed:prod:admin-bootstrap:apply`

`@seafood/api` workspace 中也新增对应脚本。

`npx prisma db seed` 仍走本地 seed，不会误跑 production seed。

## 仍等待真实运营资料

当前仍需运营确认：

- 正式商品清单。
- 稳定商品编码。
- 正式 SKU 与规格。
- 正式价格。
- 正式库存来源。
- 优惠券金额、门槛、有效期、总量、每人限领。
- 会员价策略。

## 可进入下一阶段临时空库演练的内容

可 dry-run：

- 门店 seed。
- 商品 seed。
- 库存 seed。
- 营销 seed。
- 管理员 bootstrap seed。

可在临时空库 apply 演练：

- 门店 seed。
- 商品 seed，需显式 `--allow-candidate-products`。
- 库存 seed，需显式 `--allow-candidate-inventory`。
- 营销 seed，需显式 `--allow-pending-marketing`。
- 管理员 bootstrap seed，需临时演练账号环境变量，并显式确认。

注意：临时空库演练不等于生产可上线。

## production seed 推荐执行顺序

1. stores
2. products
3. inventory
4. marketing
5. admin bootstrap
