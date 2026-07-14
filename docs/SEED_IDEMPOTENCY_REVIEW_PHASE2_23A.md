# Phase 2.23A Seed 幂等性审查

审查对象：

`apps/api/prisma/seed.ts`

本阶段只读审查 seed，不修改 seed，不执行生产 seed。

## 当前 seed 入口

根 `package.json` 中：

```json
"prisma": {
  "seed": "npm run seed -w @seafood/api"
}
```

也就是说 `npx prisma db seed` 实际走 `@seafood/api` workspace 的 seed 脚本，当前代码入口为：

`apps/api/prisma/seed.ts`

## 幂等性结论

当前 seed 大部分关键数据使用 `upsert` 或 `updateMany`，具备本地重复执行的基础幂等性：

- 广州 6 家门店：按 `Store.code` upsert。
- 上海 legacy 门店：按 `STORE_SH_001` upsert，并保持 inactive。
- 真实商品：按商品名查找后 update 或 create。
- SKU：按 `Sku.code` upsert。
- 门店 SKU 可售关系：按 `storeId_skuId` upsert。
- 库存：按 `storeId_skuId` upsert。
- 优惠券模板：按 `CouponTemplate.code` upsert。
- SKU 会员价：按 `skuId_memberLevel` upsert。
- 本地开发管理员：当 `ADMIN_DEV_USERNAME` 和 `ADMIN_DEV_PASSWORD` 存在时，按 `AdminUser.username` upsert。

## 会重复创建的风险

当前审查没有发现会在每次 seed 中无条件重复 create 的核心业务数据。

但存在以下生产风险：

1. 商品以“商品名”查找后更新，而不是稳定 code。正式商品体系建议增加更稳定的商品编码或后台创建流程。
2. 库存 seed 每次会把广州门店真实商品 SKU 的 `physicalStock`、`availableStock` 改回 100，正式库不应运行这类演示库存 seed。
3. seed 会创建/维护一个 inactive 上海 legacy 门店，用于兼容旧演示数据；正式库建议不要运行。
4. seed 会自动下架名称包含“新鲜三文鱼”或描述包含“一期演示商品”的旧 demo 商品；正式库可接受“只下架不删除”的安全策略，但更建议把 demo cleanup 拆为本地专用脚本。
5. 本地开发管理员 seed 依赖 `ADMIN_DEV_USERNAME` 和 `ADMIN_DEV_PASSWORD`，正式环境不能使用默认本地账号。

## 管理员 seed 风险

当前 dev admin seed：

- 只在 `ADMIN_DEV_USERNAME` 和 `ADMIN_DEV_PASSWORD` 存在时执行。
- 密码 hash 复用后台登录校验同一套 `hashAdminPassword`。
- 不输出密码、hash、token、secret。

上线前要求：

1. 不要使用 `admin / <legacy-local-password-removed>` 作为生产账号。
2. 不要把 `ADMIN_AUTH_SECRET=<legacy-local-auth-secret-removed>` 用到生产。
3. 生产管理员应通过独立安全流程创建，或使用仅生产可控的管理员 seed。

## 优惠券模板 seed

当前 seed 保证以下优惠券模板存在：

- `NEW_USER_1000`
- `NEW_USER_500`
- `REFERRAL_INVITER_1500`
- `REFERRAL_INVITEE_1000`

这些模板是候选版营销闭环需要的基础数据。正式上线前应确认：

1. 名称、门槛、金额、叠加规则是否符合真实运营策略。
2. 是否需要限制总量、有效期、每人领取上限。
3. 是否需要后台运营配置替代固定 seed。

## 是否会污染正式库

当前 seed 中不适合直接跑在正式库的部分：

- 本地演示管理员。
- legacy 上海演示门店。
- 演示库存回写为 100。
- demo 商品下架清理逻辑。
- 仍未最终确认运营规则的优惠券模板金额。

当前 seed 中可拆为正式基础 seed 的部分：

- 广州正式门店。
- 当前三款正式候选商品及 SKU。
- 基础优惠券模板，但上线前需运营确认。
- SKU 会员价，但上线前需确认会员价策略。

## 建议拆分 seed

正式上线前建议拆分为：

1. 基础字典 seed
   - enum 不需要 seed；可放履约方式、固定配置等。
2. 正式门店 seed
   - 仅正式门店，不含 legacy 上海演示门店。
3. 正式商品 seed
   - 使用真实商品资料、稳定商品编码、正式库存来源。
4. 营销模板 seed
   - 仅上线确认的优惠券模板和会员价。
5. 本地演示 seed
   - 本地管理员、演示库存、demo 清理等，只能本地运行。
6. 管理员 seed
   - 生产管理员走独立安全流程，不能复用本地默认账号。

## 审查结论

当前 seed 对本地开发是基本幂等的，但不应未经拆分直接用于生产库。

正式上线前必须拆分本地演示 seed 与生产基础 seed，并由运营/业务确认正式商品、库存、优惠券和管理员账号策略。
