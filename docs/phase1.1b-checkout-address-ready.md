# Phase 1.1B Checkout Address Ready

本文档用于说明当前仓库在 Phase 1.1B 中，围绕“storefront checkout 从演示地址切换为真实地址录入表单”已经完成的内容、保留边界和后续承接点。

## 1. 本阶段目标

Phase 1.1B 当前这一步的目标不是做地址簿，而是在不改后端接口契约、不改 schema 的前提下，把 `SHIPPING` 订单在 checkout 页的地址录入从“写死演示地址”推进到“真实表单录入”。

本阶段的核心目标包括：

- 仅在 `SHIPPING` 履约方式下显示地址录入区
- 让顾客在 checkout 里填写真实收货地址
- 提交时继续映射到现有 `shippingAddress` payload
- 保持订单 snapshot 逻辑不变
- 不扩展到地址簿、默认地址、支付体系

## 2. 当前已完成内容

当前仓库已经完成以下能力：

- storefront checkout 不再为 `SHIPPING` 订单写死演示地址
- checkout 已新增真实地址录入表单
- 当前表单字段包括：
- `收货人`
- `联系电话`
- `省`
- `市`
- `区 / 区县`
- `详细地址`
- `邮政编码（选填）`
- 地址录入区只在 `fulfillmentType === 'SHIPPING'` 时显示
- 切换到 `STORE_PICKUP` 时地址表单会隐藏
- 切回 `SHIPPING` 时已填写内容会保留，不会被自动清空
- 必填字段未填完整时不允许提交订单
- 页面会给出中文提示，说明还缺少哪些字段
- 提交时继续调用现有创建订单接口，不改接口路径和字段契约
- 提交时地址值会继续写入现有 `shippingAddress` snapshot 字段
- checkout 右侧订单摘要已能同步显示当前填写的收货人、联系电话和收货地址

## 3. 现有地址字段 contract

当前 checkout 提交到后端时，继续沿用既有 contract：

- `shippingAddress.receiverName`
- `shippingAddress.phone`
- `shippingAddress.province`
- `shippingAddress.city`
- `shippingAddress.district`
- `shippingAddress.detail`
- `shippingAddress.postalCode`

需要特别强调：

- 页面显示文案可以叫“详细地址”
- 但提交给后端的字段名仍然必须是 `detail`
- 当前没有引入 `addressNote`
- 当前没有修改 schema 或 DTO

## 4. checkout 当前录入规则

### 显示规则

- 当履约方式为 `STORE_PICKUP` 时，不显示收货地址表单
- 当履约方式为 `SHIPPING` 时，显示完整地址录入区

### 保留规则

- 用户在 `SHIPPING` 模式下填写的地址信息会保留在当前页面状态中
- 切换到 `STORE_PICKUP` 后不会清空
- 切回 `SHIPPING` 时可继续编辑

### 提交规则

- 只有地址必填字段完整时，订单才允许提交
- 如果地址不完整，按钮会保持不可提交状态
- 如果仍触发提交校验，页面会用中文说明缺失字段

## 5. 必填 / 选填字段

### 必填

- `receiverName`
- `phone`
- `province`
- `city`
- `district`
- `detail`

### 选填

- `postalCode`

### 当前未纳入

- `addressNote`

原因是当前 contract 与 schema 中没有该字段，本阶段也不扩展接口。

## 6. Snapshot 保存原则

当前阶段继续遵循既有 snapshot 原则：

1. 顾客在 checkout 提交 `SHIPPING` 订单时，地址会作为订单快照写入。
2. 订单详情页与后台订单详情页读取的都是该 snapshot。
3. 后续即使引入地址簿，也不能反向修改历史订单的收货地址。
4. 地址簿只应该服务于“未来订单怎么带入默认地址”，不应该回写已创建订单。

## 7. 手动验收步骤

### 本地启动

1. 启动 API：

```bash
npm run start -w @seafood/api
```

2. 启动 storefront：

```bash
npm run dev -w @seafood/storefront-web
```

### checkout 验收

1. 从商品详情进入下单页，保持现有 `productId` / `skuId` 参数方式。
2. 默认查看 `STORE_PICKUP` 模式，确认页面不显示收货地址表单。
3. 切换到 `邮寄发货`，确认页面出现收货地址录入区。
4. 依次检查字段：
   - 收货人
   - 联系电话
   - 省
   - 市
   - 区 / 区县
   - 详细地址
   - 邮政编码（选填）
5. 不完整填写时，确认：
   - 提交按钮不可用
   - 页面提示当前缺失的字段
6. 填完整必填字段后，确认：
   - 可正常提交
   - 仍调用现有创建订单接口
   - 创建后跳转到订单详情页
7. 切换到 `STORE_PICKUP` 再切回 `SHIPPING`，确认之前填写的地址内容仍然保留。

## 8. 当前仍未完成内容

本阶段刻意没有做，且仍留给后续判断的内容包括：

- 地址簿
- 默认地址管理
- 多地址切换
- 地址新增 / 编辑 / 删除能力
- 地址校验服务
- 配送范围判断
- 更复杂的地址联动选择
- 微信地址能力
- 支付体系改造

这些内容不属于当前“checkout 地址表单已就绪”这一步的阻塞项。

## 9. 下一阶段建议

下一阶段建议只写到“是否进入地址簿”，不要展开到支付体系。

更合理的下一步最小方向是：

- 先判断是否需要地址簿
- 如果需要，再先做最小地址簿 contract 与页面范围定义
- 保持历史订单 snapshot 不可变

在进入地址簿之前，不建议同时展开：

- 微信支付
- 小程序地址能力
- 新订单接口
- schema 扩表

## 10. 阶段结论

当前仓库可以视为：

- `Phase 1.1B` 地址口径已收口
- `Phase 1.1B` checkout 真实地址录入表单已就绪

如果需要一个准确的阶段名，建议使用：

- 首选：`phase1.1b-checkout-address-ready`
- 备选：`phase1.1b-shipping-address-form-ready`

建议优先使用 `phase1.1b-checkout-address-ready`，因为它最准确描述了当前成果：地址体系尚未扩展到地址簿，但 checkout 的真实地址录入已经可以稳定作为下一阶段起点。
