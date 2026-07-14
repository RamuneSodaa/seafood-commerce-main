# Phase 2.23A2 生产 Seed 拆分任务单

阶段：Phase 2.23A2_migration_draft_quarantine_and_history_reconciliation

## 目标

当前 `apps/api/prisma/seed.ts` 对本地开发基本幂等，但混合了本地演示数据、正式候选数据、管理员开发账号、库存初始化和 demo 清理逻辑。

正式上线前必须拆分 seed，避免本地演示行为污染生产库。

## 1. 本地开发 seed

用途：本地演示、开发验收、同事试用本地后台。

允许包含：

- 本地管理员：`admin / <legacy-local-password-removed>`
- 本地管理员 secret
- 本地库存初始化
- demo cleanup
- 本地验证用优惠券模板
- 本地测试数据修复逻辑

禁止用于生产。

## 2. 生产门店 seed

用途：正式初始化门店基础数据。

只保留：

- 广州真实门店。
- 真实门店名称、地址、联系人、电话。
- 门店启用状态。

禁止包含：

- legacy 上海门店。
- 演示门店。
- 测试地址。

## 3. 生产商品 seed

用途：正式初始化真实商品和 SKU。

只保留：

- 真实商品。
- 真实 SKU。
- 稳定商品编码。
- 真实价格。
- 上架状态。
- 自提/邮寄支持状态。

上线前待补：

- 稳定商品编码，不只依赖商品名。
- 真实商品资料。
- 真实商品图/详情图。
- 正式库存来源策略。

## 4. 生产营销 seed

用途：初始化已确认上线的营销规则。

只保留业务已确认的：

- 优惠券模板。
- 会员价。
- 邀请奖励模板。

上线前必须确认：

- 券名称。
- 门槛。
- 优惠金额。
- 可叠加规则。
- 有效期。
- 总量。
- 每人限领。

## 5. 生产管理员创建

不能使用本地默认账号。

要求：

- 生产管理员通过独立安全流程创建。
- 不使用 `admin / <legacy-local-password-removed>`。
- 不使用 `<legacy-local-auth-secret-removed>`。
- 不在代码仓库写入真实密码、hash、token、secret。
- 生产管理员创建过程需要记录操作人和时间。

## 6. 明确禁止生产运行的 seed 内容

以下内容禁止在生产库运行：

- 演示库存回写为 100。
- legacy 上海门店。
- demo 商品下架清理。
- 本地管理员默认账号。
- local admin secret。
- 任何测试商品或演示商品。
- 任何会覆盖真实库存、真实商品价格、真实门店状态的本地修复逻辑。

## 拆分建议

建议后续拆分为：

- `seed.local.ts`
- `seed.production.stores.ts`
- `seed.production.products.ts`
- `seed.production.marketing.ts`
- `seed.production.admin.bootstrap.ts` 或独立安全管理命令

并在 package scripts 中明确区分本地和生产，不允许误执行。

## 当前结论

当前 seed 适合本地开发，不适合未经拆分直接运行在生产库。
