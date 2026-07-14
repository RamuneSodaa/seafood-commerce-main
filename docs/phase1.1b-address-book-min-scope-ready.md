# Phase 1.1B Address Book Min Scope Ready

本文档用于定义 Phase 1.1B-2 的“最小地址簿范围”，目标不是设计完整地址系统，而是给下一步代码实现一个可直接执行的最小闭环范围。

当前前提已经成立：

- checkout 真实地址录入表单已完成
- 订单仍保存 `shippingAddress` snapshot
- snapshot 原则不能改变
- 本轮不是完整地址系统，只做最小地址簿闭环

## 1. 为什么现在进入最小地址簿，而不是继续停留在手填地址

checkout 真实地址录入已经解决了“演示地址写死”的问题，但继续完全手填，会有两个直接问题：

- 顾客每次下单都要重复输入整套地址
- checkout 已经具备地址 contract，但还没有“默认地址带入”这一层体验闭环

因此，当前更合理的下一步不是扩成完整地址系统，而是补上最小地址簿闭环：

- 顾客新增一个地址
- 顾客选择一个默认地址
- checkout 自动带入默认地址

做到这三件事，就能明显降低重复录入成本，同时保持范围可控，不会过早扩散到复杂地址能力。

## 2. 本轮最小目标

Phase 1.1B-2 只做以下最小目标：

1. 顾客可以新增一个地址。
2. 顾客可以把其中一个地址设为默认地址。
3. checkout 进入 `SHIPPING` 模式时，自动带入默认地址。
4. 顾客仍可在 checkout 中修改本次订单地址。
5. 提交订单时，继续把当前 checkout 地址写入订单 snapshot，而不是直接引用地址簿记录。

这里的关键边界是：

- 地址簿服务于“带入默认值”
- 订单仍保存独立 snapshot
- 地址簿不能替代订单 snapshot

## 3. 本轮最小数据模型建议

建议新增最小模型：`CustomerAddress`

最小字段建议如下：

- `id: string`
- `customerId: string`
- `receiverName: string`
- `phone: string`
- `province: string`
- `city: string`
- `district: string`
- `detail: string`
- `postalCode?: string | null`
- `isDefault: boolean`
- `createdAt: DateTime`
- `updatedAt: DateTime`

### 说明

- 字段尽量沿用当前 `shippingAddress` contract，避免再做一套新命名
- 仍保留 `detail`，不改成 `detailAddress`
- 当前不加入 `addressNote`
- 当前不加入 `label`
- 当前不加入 `sortOrder`
- 当前不加入地理编码或经纬度

### 默认地址规则建议

- 每个 `customerId` 最多只能有一个 `isDefault = true`
- 新增第一条地址时，可直接自动设为默认
- 非第一条地址新增时，是否默认由显式动作决定，不在“新增接口”里做复杂策略

## 4. 本轮最小 API 范围建议

本轮只建议加最小顾客地址接口，不改现有订单 contract。

### 4.1 地址列表

`GET /customer/addresses`

用途：

- 返回当前顾客自己的地址列表
- storefront “我的地址”页使用
- checkout 带入默认地址时也可复用

返回字段建议与 `CustomerAddress` 最小字段一致。

### 4.2 新增地址

`POST /customer/addresses`

用途：

- 顾客新增一条地址

请求体建议：

- `receiverName`
- `phone`
- `province`
- `city`
- `district`
- `detail`
- `postalCode?`

行为建议：

- 若当前顾客还没有任何地址，新地址自动设为默认
- 若已有地址，新地址默认 `isDefault = false`

### 4.3 设默认地址

`POST /customer/addresses/:id/set-default`

用途：

- 把指定地址设为默认地址

行为建议：

- 只能操作当前顾客自己的地址
- 设默认时，需要把同一顾客其他地址的 `isDefault` 置为 `false`

### 4.4 checkout 读取默认地址

本轮不建议新增“专门给 checkout 的独立接口”。

建议 checkout 直接复用：

- `GET /customer/addresses`

然后在前端取 `isDefault === true` 的地址作为默认带入值。

原因：

- 范围更小
- 接口更少
- 能直接支撑“我的地址”页和 checkout 两个入口

## 5. storefront 最小前端范围

### 5.1 地址入口放哪里

建议最小入口放在 storefront 现有订单相关区域附近，而不是新增复杂导航体系。

最小方案建议：

- 在 storefront 顶部导航或订单页附近增加一个轻量入口：`我的地址`

### 5.2 是否单独一个“我的地址”页面

建议：要。

最小页面建议为：

- 路由：`/addresses`

原因：

- 地址新增和默认设置需要稳定入口
- 不建议把“新增地址”直接塞进 checkout
- 单独页面更利于后续扩展而不污染 checkout 主链路

### 5.3 checkout 如何带入默认地址

建议行为：

1. 打开 checkout 时，如果当前是 `SHIPPING` 模式，则请求地址列表。
2. 如果存在默认地址，则用默认地址填充当前地址表单。
3. 顾客仍可直接在 checkout 修改字段。
4. 修改只影响本次下单表单，不反写地址簿。
5. 提交订单时，继续把当前表单值写入 `shippingAddress` snapshot。

### 5.4 checkout 当前最小交互边界

本轮先不做复杂地址切换器，保持最小闭环：

- 自动带入默认地址
- 顾客手动修改当前表单
- 提交时写 snapshot

也就是说，本轮不要求在 checkout 内：

- 切换多个地址
- 新增地址
- 管理地址列表

这些动作放在 `/addresses` 页面完成即可。

## 6. 明确这轮不做什么

本轮明确不做以下内容：

- 编辑地址
- 删除地址
- 地址标签，例如“家 / 公司”
- 微信地址能力
- 小程序相关
- admin 端地址管理
- checkout 内地址列表切换器
- 地址排序
- 地图选点
- 配送范围校验
- 多级联动行政区组件

这样可以保证本轮只聚焦“新增地址 + 默认地址 + checkout 带入”。

## 7. 受影响文件范围建议

### schema

建议受影响：

- `prisma/schema.prisma`

新增：

- `CustomerAddress` 模型

### API 模块

建议受影响：

- `apps/api/src/modules/` 下新增 `customer-addresses` 或等效轻量模块
- DTO
- controller
- service
- repository（如果当前项目结构需要）

同时需要遵守：

- 使用现有 `x-role: CUSTOMER`
- 使用现有 `x-user-id` 做顾客隔离

### storefront 页面 / lib / 组件

建议受影响：

- `apps/storefront-web/src/app/addresses/page.tsx`
- `apps/storefront-web/src/app/checkout/page.tsx`
- `apps/storefront-web/src/lib/api.ts`

如有必要，可做极小范围组件补充，但不建议引入新的复杂设计层。

## 8. 下一步最小代码任务建议

下一步最小代码任务建议只做到：

### 先打通“新增地址 + 默认地址 + checkout 带入”

建议拆成以下最小实现顺序：

1. 在 schema 中新增 `CustomerAddress`。
2. 在 API 中新增：
   - 地址列表
   - 新增地址
   - 设默认地址
3. 在 storefront 新增 `/addresses` 页面：
   - 展示地址列表
   - 新增地址表单
   - “设为默认”按钮
4. 在 checkout 中接入地址列表：
   - 读取默认地址
   - 自动带入到现有地址表单
   - 提交订单时仍写入 snapshot

### 本轮成功标准

如果以下三点成立，就算本轮完成：

- 顾客能新增至少一条地址
- 顾客能明确设定一个默认地址
- checkout 打开 `SHIPPING` 时能自动带入默认地址

## 9. 阶段结论

当前建议把这个阶段命名为：

- 首选：`phase1.1b-address-book-min-scope-ready`

这个命名的含义是：

- 不是完整地址系统设计
- 不是泛泛讨论地址簿
- 而是已经把“最小可开工范围”定义清楚，下一步可以直接进入实现
