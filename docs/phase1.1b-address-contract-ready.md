# Phase 1.1B Address Contract Ready

本文档用于在不改接口、不改 schema、不做地址簿实现的前提下，先把 `SHIPPING` 订单相关的地址字段口径收口清楚，为下一步将 storefront checkout 从“演示地址”切换为“真实地址录入表单”做准备。

## 1. 为什么这一阶段先做地址口径收口，而不是直接做地址簿

当前系统已经具备最小真实发货运营闭环，但地址部分仍停留在“演示地址写死”的状态。此时如果直接上地址簿，会同时引入：

- 地址录入字段定义问题
- 订单创建 payload 字段命名问题
- 历史订单地址 snapshot 冻结规则问题
- storefront / admin 展示字段一致性问题

如果这些口径未先统一，就容易出现：

- checkout 表单字段和后端契约不一致
- 订单展示字段和实际保存字段不一致
- 未来地址簿回填历史订单的边界不清
- 同一概念在不同层使用不同命名

因此，Phase 1.1B 的第一步应该先固定“地址 contract”，再进入真实地址录入表单，最后才考虑地址簿。

## 2. 当前系统里地址相关的真实现状

基于当前仓库代码，`SHIPPING` 地址实现现状如下：

### storefront checkout

`apps/storefront-web/src/app/checkout/page.tsx`

- 当 `fulfillmentType === 'SHIPPING'` 时，前端会在提交时自动写入一份演示地址
- 当前并没有真实地址输入表单
- 当前 payload 中的地址字段是：
  - `receiverName`
  - `phone`
  - `province`
  - `city`
  - `district`
  - `detail`
- 当前 checkout 没有传 `postalCode`
- 当前 checkout 没有 `addressNote`

### storefront API 类型

`apps/storefront-web/src/lib/api.ts`

- storefront 订单返回中的 `shippingAddress` 类型字段为：
  - `receiverName`
  - `phone`
  - `province`
  - `city`
  - `district`
  - `detail`
  - `postalCode?`

### storefront 订单详情展示

`apps/storefront-web/src/app/orders/[id]/page.tsx`

- 顾客侧订单详情从 `order.shippingAddress` 读取地址快照
- 当前展示方式为：
  - 第一行：`receiverName + phone`
  - 第二行：`province + city + district + detail`
- 当前没有展示 `postalCode`
- 当前没有 `addressNote`

### admin 订单详情展示

`apps/admin-web/src/app/workbench/orders/[id]/page.tsx`

- 后台订单详情同样从 `order.shippingAddress` 读取地址快照
- 当前展示方式与 storefront 基本一致：
  - 第一行：`receiverName + phone`
  - 第二行：`province + city + district + detail`
- 当前没有展示 `postalCode`
- 当前没有 `addressNote`

### API DTO / service / repository

`apps/api/src/modules/orders/dto/order-workflow.dto.ts`

- 当前 `CreateOrderDto.shippingAddress` 已定义字段：
  - `receiverName`
  - `phone`
  - `province`
  - `city`
  - `district`
  - `detail`
  - `postalCode?`

`apps/api/src/modules/orders/order-workflow.service.ts`

- `SHIPPING` 订单必须传 `shippingAddress`
- 创建订单时会把地址写入 `OrderShippingAddressSnapshot`
- 当前 service 写入的 snapshot 字段与 DTO 一致：
  - `receiverName`
  - `phone`
  - `province`
  - `city`
  - `district`
  - `detail`
  - `postalCode`

`apps/api/src/modules/orders/order.repository.ts`

- 订单列表和订单详情接口都已经 `include: { shippingAddress: true }`
- 这说明当前前后台看到的地址都是订单 snapshot，而不是临时拼装

### Prisma schema

`prisma/schema.prisma`

当前 `OrderShippingAddressSnapshot` 字段为：

- `receiverName`
- `phone`
- `province`
- `city`
- `district`
- `detail`
- `postalCode?`

当前 schema 中没有：

- `detailAddress`
- `addressNote`

## 3. SHIPPING 订单最小必需地址字段建议

基于当前实现，建议将 `SHIPPING` 订单最小可用地址字段定义为：

- `receiverName`
- `phone`
- `province`
- `city`
- `district`
- `detailAddress`
- `postalCode`
- `addressNote`

但需要区分“产品口径”与“当前契约口径”：

### 产品口径

从业务和表单体验上，建议 checkout 录入时对外使用：

- `receiverName`
- `phone`
- `province`
- `city`
- `district`
- `detailAddress`
- `postalCode`

其中：

- `detailAddress` 更符合表单语义，表达“详细地址”
- `postalCode` 在当前阶段可选
- `addressNote` 不建议作为当前最小闭环的必备字段

### 当前契约口径

由于现有接口、DTO、schema 都已经稳定使用 `detail`，因此在本阶段不建议改动已有契约。

也就是说，当前系统真正应继续使用的 payload / snapshot 字段仍然是：

- `receiverName`
- `phone`
- `province`
- `city`
- `district`
- `detail`
- `postalCode?`

结论：

- 表单文案层可以叫“详细地址”
- 如果前端内部状态未来想命名成 `detailAddress`，也只能在前端本地映射
- 发给后端的 `shippingAddress` 仍应保持 `detail`

### 关于 `addressNote`

当前仓库没有 `addressNote` 字段，也没有对应展示或存储位置。

建议：

- Phase 1.1B 不把 `addressNote` 纳入最小必需字段
- 若后续确实需要，可作为可选扩展字段单独评估
- 在未改接口和 schema 前，不应在 checkout 表单里引入该字段并假装已保存

## 4. 字段分层建议

### 4.1 下单录入字段

checkout 表单下一步建议收口为这些字段：

- `receiverName`
- `phone`
- `province`
- `city`
- `district`
- `detail`  
  页面显示文案建议叫“详细地址”
- `postalCode`  
  可选

### 4.2 订单 snapshot 保存字段

订单创建时保存到 snapshot 的字段建议保持与当前契约一致：

- `receiverName`
- `phone`
- `province`
- `city`
- `district`
- `detail`
- `postalCode?`

### 4.3 storefront 展示字段

顾客侧订单详情建议继续按当前两层展示：

- 联系人层：
  - `receiverName`
  - `phone`
- 地址正文层：
  - `province`
  - `city`
  - `district`
  - `detail`
- `postalCode` 当前可不展示，后续如需要再补

### 4.4 admin 展示字段

后台订单详情建议与 storefront 保持一致，但更偏作业视角：

- 联系人层：
  - `receiverName`
  - `phone`
- 地址正文层：
  - `province`
  - `city`
  - `district`
  - `detail`
- `postalCode` 当前非阻塞，可暂不展示

## 5. 必填 / 选填规则建议

基于当前最小真实发货闭环，建议规则如下：

### 必填

- `receiverName`
- `phone`
- `province`
- `city`
- `district`
- `detail`

原因：

- 这些字段已经被当前 DTO、service、schema 覆盖
- 这套字段已经足够支撑最小发货与订单展示
- 不需要等地址簿也能先做真实地址录入

### 选填

- `postalCode`

原因：

- 当前 DTO 和 schema 已支持可选保存
- 但 storefront / admin 当前未强依赖该字段展示

### 暂不纳入当前 contract

- `addressNote`

原因：

- 当前接口和 schema 中不存在
- 当前主链路不依赖
- 现在加进去只会让 contract 和实现脱节

## 6. 字段命名建议

命名建议必须尽量沿用当前系统风格，不随意改动已存在契约。

### 建议保留的后端 / payload / snapshot 命名

- `shippingAddress`
- `receiverName`
- `phone`
- `province`
- `city`
- `district`
- `detail`
- `postalCode`

### 建议使用在显示层或表单文案里的说法

- `receiverName` -> `收货人`
- `phone` -> `联系电话`
- `province` -> `省`
- `city` -> `市`
- `district` -> `区 / 区县`
- `detail` -> `详细地址`
- `postalCode` -> `邮政编码`

### 不建议在当前阶段做的事

- 不建议把后端契约里的 `detail` 改名成 `detailAddress`
- 不建议在未改 schema 的情况下引入 `addressNote`
- 不建议在 storefront 和 admin 各自发明不同的地址字段结构

## 7. Snapshot 原则

订单地址必须遵循 snapshot 原则。

建议明确如下：

1. `SHIPPING` 订单在创建时冻结地址 snapshot。
2. 订单详情页和后台详情页都读取该 snapshot。
3. 后续即使引入地址簿，也不能反向修改历史订单地址。
4. 地址簿只影响“未来新订单默认带入什么地址”，不能回写已创建订单。

这条原则当前已经和现有实现方向一致，因为：

- 创建订单时 service 已写入 `OrderShippingAddressSnapshot`
- 前后台详情页当前都读取 `order.shippingAddress`

因此，Phase 1.1B 之后的所有地址能力，都应建立在“历史订单地址不可变”这一前提上。

## 8. 下一步最小代码任务建议

下一步最小代码任务建议只做到：

### 把 checkout 的演示地址改成真实地址录入表单

范围建议：

- 只改 `apps/storefront-web/src/app/checkout/page.tsx`
- 如有必要，做极小范围类型补充
- 不改后端接口
- 不改 schema
- 不做地址簿

### 最小表单字段建议

- 收货人
- 联系电话
- 省
- 市
- 区 / 区县
- 详细地址
- 邮政编码（选填）

### 提交建议

- 仅在 `fulfillmentType === 'SHIPPING'` 时展示该表单
- 提交时映射为当前既有 payload：
  - `shippingAddress.receiverName`
  - `shippingAddress.phone`
  - `shippingAddress.province`
  - `shippingAddress.city`
  - `shippingAddress.district`
  - `shippingAddress.detail`
  - `shippingAddress.postalCode`

### 当前明确不做

- 地址簿
- 默认地址管理
- 地址编辑历史
- 配送范围校验
- 微信地址能力
- 支付能力改造

## 9. 阶段结论

当前仓库的地址相关 contract 已经具备一个清晰基础：

- 后端契约已存在
- snapshot 模型已存在
- 前后台读取路径已存在
- 缺的不是 schema，而是 checkout 真实地址录入

因此，当前阶段可以命名为：

- 首选：`phase1.1b-address-contract-ready`

这个命名意味着：地址体系尚未完整产品化，但“字段口径、snapshot 原则、最小录入边界”已经可以进入下一步实现。
