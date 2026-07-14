# Phase 2.23B 下一阶段空库迁移演练 Runbook

本文件只描述下一阶段如何演练，不在 Phase 2.23B 执行。

## 目标

在不影响本地开发库和生产库的前提下，用临时空库验证 clean baseline SQL、生产 seed 候选、API 和顾客端核心链路。

## 1. 创建临时空库

要求：

- 使用本机或预发布环境的临时 PostgreSQL。
- 数据库名称清楚标明 dry-run。
- 不使用生产 DATABASE_URL。
- 不复用当前本地开发库。

## 2. 使用 clean baseline migration

执行对象：

`docs/migration_drafts/phase2_23b_clean_baseline_empty_db/migration.clean_baseline_empty_db.sql`

要求：

- 执行前人工确认目标库为空。
- 执行前确认连接串指向临时空库。
- 记录执行日志。

## 3. 执行生产 seed 候选

要求：

- 只运行拆分后的生产 seed 候选。
- 不运行本地 seed。
- 不创建本地默认管理员。
- 不写入 demo 商品、legacy 上海门店、演示库存回写。

## 4. 验证 Prisma Client

建议检查：

- Prisma Client 可以连接。
- 27 个主要模型可查询。
- 关键 enum 正常。
- 唯一索引和外键正常。

## 5. 启动 API

要求：

- API 使用临时空库环境变量。
- 不使用生产支付密钥。
- 不执行真实支付。

## 6. 顾客端核心接口 smoke test

至少验证：

- `GET /products`
- `GET /stores`
- 顾客登录或本地身份换取。
- 购物车添加/查询。
- checkout quote-preview。
- 创建待支付订单。
- 取消订单释放券。
- 优惠券列表。
- 会员档案。

## 7. build / tsc

执行：

```bash
npm run build:weapp -w @seafood/storefront-miniapp
npx tsc --noEmit -p apps/api/tsconfig.json
```

## 8. 记录结果

记录：

- SQL 执行结果。
- seed 结果。
- smoke test 结果。
- build/tsc 结果。
- 发现的问题。

## 9. 销毁临时库

演练完成后销毁临时库。

注意：

- 只销毁临时 dry-run 库。
- 不影响本地开发库。
- 不影响生产库。

## 10. 产出物

下一阶段建议产出：

- 空库演练日志。
- 表/索引/约束验证结果。
- seed 结果。
- 核心接口 smoke test 报告。
- 是否可以进入支付真机专项验收的结论。

## Phase 2.23D 建议执行顺序补充

1. 建临时空库。
2. 执行 clean baseline migration。
3. 执行 stores apply。
4. 执行 products apply，并显式传入 `--allow-candidate-products`。
5. 执行 inventory apply，并显式传入 `--allow-candidate-inventory`。
6. 执行 marketing apply，并显式传入 `--allow-pending-marketing`。
7. 执行 admin bootstrap apply，使用临时安全账号。
8. 启动 API。
9. 执行核心接口 smoke test。
10. 销毁临时库。

建议直接使用 workspace 命令，确保额外参数传递明确：

```bash
npm run seed:prod:products:apply -w @seafood/api -- --allow-candidate-products
npm run seed:prod:inventory:apply -w @seafood/api -- --allow-candidate-inventory
npm run seed:prod:marketing:apply -w @seafood/api -- --allow-pending-marketing
```
