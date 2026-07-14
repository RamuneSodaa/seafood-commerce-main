# Phase 2.23C2 生产库存 Seed 计划

阶段：Phase 2.23C2_production_inventory_seed_and_seed_apply_preflight  
日期：2026-06-14

## 为什么必须有库存 seed 或库存导入

空库 clean baseline 执行后，如果只写入门店、商品、SKU、优惠券和会员价，但没有库存，顾客端交易闭环无法真实跑通。

库存会影响：

- 商品是否可售。
- 购物车数量校验。
- checkout 报价和提交订单。
- 凑单推荐。
- 再来一单可购买性判断。
- 订单提交后的库存预留或扣减。

## 没有库存会影响哪些功能

1. 商品可售：SKU 可能存在，但没有门店库存和可售关系。
2. 购物车：加购后无法确认当前库存。
3. checkout：无法判断服务门店是否能履约。
4. 凑单：无法推荐可售 SKU。
5. 再来一单：无法判断原订单商品是否当前可买。
6. 订单提交：无法完成库存校验和预留。

## 当前库存候选数据是否真实运营确认

不是。

当前 `PRODUCTION_INVENTORY_CANDIDATES` 只为临时空库演练准备：

- 只给主门店候选 SKU 设置少量正库存。
- 每项库存均标记 `requiresOperationalConfirmation: true`。
- 默认 dry-run 不写库。
- apply 时必须额外传入 `--allow-candidate-inventory`。

这不是正式运营确认库存。

## dry-run/apply 规则

`seed.production.inventory.ts` 默认 dry-run。

dry-run：

- 输出门店 code、SKU code、库存数量摘要。
- 不连接生产库。
- 不写数据库。

apply：

- 必须显式 `--apply --confirm-production-seed`。
- 如库存仍标记为候选，还必须显式 `--allow-candidate-inventory`。
- 如果找不到 storeCode 或 skuCode，必须失败。
- 如果库存数量为负数，必须失败。
- 如果 safetyStock 大于 physicalStock，必须失败。

## 禁止生产运行的数据

禁止把以下内容作为正式生产库存写入：

- 所有 SKU、所有门店默认 100。
- 演示库存。
- 未确认门店库存。
- 未确认 SKU 库存。
- 会覆盖真实库存的本地修复逻辑。

## 正式生产前库存必须由谁确认

正式生产库存必须由商家/运营确认，至少确认：

- 门店。
- SKU。
- 实物库存。
- 可售库存策略。
- 安全库存。
- 是否支持自提/邮寄。

## 临时空库演练如何使用候选库存

临时空库演练可以执行：

```bash
npm run seed:prod:inventory:apply -w @seafood/api -- --allow-candidate-inventory
```

前提：

- DATABASE_URL 指向临时空库。
- 已先执行 stores seed 和 products seed。
- 明确这只是演练库存。
- 演练后销毁临时库。

不能把该演练结果当作生产库存确认。
