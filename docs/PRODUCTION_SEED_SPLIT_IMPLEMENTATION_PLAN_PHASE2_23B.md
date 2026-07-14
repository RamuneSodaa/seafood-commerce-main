# Phase 2.23B 生产 Seed 拆分实施计划

本阶段只写实施计划，不拆代码。

## 目标

把当前混合型 `apps/api/prisma/seed.ts` 拆分为本地开发 seed 和生产 seed，避免本地演示数据、默认管理员和演示库存污染正式库。

## 建议文件

- `apps/api/prisma/seed.local.ts`
- `apps/api/prisma/seed.production.stores.ts`
- `apps/api/prisma/seed.production.products.ts`
- `apps/api/prisma/seed.production.marketing.ts`
- `apps/api/prisma/seed.production.admin.bootstrap.ts`

## seed.local.ts

包含：

- 本地管理员 `admin / <legacy-local-password-removed>`
- 本地管理员 secret
- 本地演示库存
- 本地 demo cleanup
- 本地测试优惠券模板
- 本地开发需要的修复脚本入口

禁止：

- 在生产环境执行。
- 连接生产数据库。
- 写入真实生产管理员。

## seed.production.stores.ts

包含：

- 正式门店 code、名称、地址、联系人、电话、启用状态。

禁止：

- legacy 上海门店。
- 演示门店。
- 测试地址。
- 本地 contact 占位数据。

## seed.production.products.ts

包含：

- 正式商品。
- 真实 SKU。
- 稳定商品编码。
- 正式价格。
- 上架状态。
- 自提/邮寄支持状态。

禁止：

- 测试商品。
- 演示商品。
- “新鲜三文鱼”等旧 demo 数据。
- 用商品名作为唯一长期稳定识别方式。

## seed.production.marketing.ts

包含：

- 经运营确认的优惠券模板。
- 经运营确认的会员价。
- 邀请奖励券模板。

禁止：

- 未确认金额/门槛/有效期的营销规则。
- 只为本地演示设计的券。
- 无总量或无有效期但不符合运营策略的正式券。

## seed.production.admin.bootstrap.ts

包含：

- 生产管理员安全创建流程。
- 可选一次性 bootstrap 令牌校验。
- 创建完成后的禁用/销毁机制。

禁止：

- `admin / <legacy-local-password-removed>`
- `<legacy-local-auth-secret-removed>`
- 在代码中写真实密码、hash、token、secret。

## package scripts 命名建议

建议：

- `seed:local`
- `seed:prod:stores`
- `seed:prod:products`
- `seed:prod:marketing`
- `seed:prod:admin-bootstrap`

不建议：

- 让 `npx prisma db seed` 默认跑生产 seed。
- 用模糊脚本名让本地 seed 和生产 seed 混淆。

## dry-run 和二次确认

生产 seed 必须满足：

1. 支持 dry-run，先输出将要 upsert 的对象数量和 code。
2. 默认不执行写入，除非显式传入确认参数。
3. 输出不得包含密码、secret、token。
4. 写入后输出非敏感摘要。

## 永远不能进生产 seed 的内容

- 本地管理员 `admin / <legacy-local-password-removed>`。
- local admin secret。
- 演示库存回写为 100。
- legacy 上海门店。
- demo 商品下架清理。
- 测试商品或演示商品。
- 会覆盖真实库存、真实商品价格、真实门店状态的本地修复逻辑。

## 实施顺序建议

1. 先抽取常量：门店、商品、营销模板。
2. 再拆本地 seed 和生产 seed。
3. 增加 dry-run 模式。
4. 在临时空库运行生产 seed 候选。
5. 跑顾客端核心接口 smoke test。
6. 审查结果通过后，再纳入正式上线流程。
