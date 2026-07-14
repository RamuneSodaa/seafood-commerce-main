# Phase 2A Miniapp Demo Ready

本文档用于说明当前仓库中 `apps/storefront-miniapp` 已经完成的最小主链路、沿用的业务边界，以及进入下一阶段前的承接点。

当前目标不是扩展微信能力，而是确认小程序壳层已经达到：

- 可连接现有后端 API
- 可演示一条完整顾客主链路
- 可在不改后端契约的前提下继续迭代

## 1. 本阶段目标

Phase 2A 的目标是基于现有 API、storefront 业务 contract 和 demo customer 机制，搭出一个最小可运行的小程序前端壳层，并打通以下主链路：

`商品列表 -> 商品详情 -> checkout -> 我的订单 -> 订单详情`

本阶段保持以下边界不变：

- 不改后端接口契约
- 不接微信登录
- 不接 `openid / unionid`
- 不接微信支付
- 不接微信原生地址能力
- 不扩展地址簿能力
- 不抽 shared-types
- 不改现有 web / admin 页面

## 2. 当前已完成页面与能力

当前 miniapp 已完成以下页面与最小能力：

### 2.1 商品列表页

- 已连接现有 `GET /products`
- 可展示商品名称、描述摘要、最小价格信息
- 已具备：
- loading
- 空状态
- 错误提示
- “查看详情”跳转入口

### 2.2 商品详情页

- 已连接现有 `GET /products/:id`
- 可展示：
- 商品名称
- 商品描述
- SKU 列表
- SKU 价格
- 支持的履约方式
- 已补最小 SKU 选中能力
- 已支持从商品详情真实跳转到 checkout，并带上：
- `productId`
- `skuId`

### 2.3 checkout 页

- 已连接现有：
- `GET /products/:id`
- `GET /stores`
- `GET /customer/addresses`
- `POST /orders`
- 可展示当前商品、当前 SKU、数量、门店和履约方式
- 已支持 `STORE_PICKUP / SHIPPING` 切换
- `SHIPPING` 模式下已支持地址表单
- 已支持读取地址列表并自动带入默认地址
- 顾客仍可手动修改本次下单地址
- 提交时继续按现有 snapshot contract 创建订单：
- `items`
- `fulfillmentType`
- `shippingAddress`
- 创建订单成功后，已跳转到“我的订单”

### 2.4 我的订单页

- 已连接现有 `GET /orders`
- 可展示每笔订单的最小摘要：
- 订单状态
- 履约方式
- 总金额
- 下单时间
- 商品件数
- 已具备：
- loading
- 空状态
- 错误提示
- 刷新 / 重试入口
- 已支持从订单列表跳转到订单详情

### 2.5 订单详情页

- 已连接现有 `GET /orders/:id`
- 可展示：
- 订单状态
- 履约方式
- 下单时间
- 总金额
- 商品明细
- 对 `SHIPPING` 订单，已展示：
- 收货地址 snapshot
- 快递公司
- 运单号
- 发货时间
- 送达时间
- 对 `STORE_PICKUP` 订单，已展示：
- 门店名称 / 地址
- 提货码
- 提货日期 / 时段
- 完成取货时间
- 已具备：
- loading
- 错误提示
- 空状态
- 返回订单列表入口

## 3. 当前 miniapp 主链路

当前可演示的小程序顾客主链路如下：

1. 顾客进入商品列表页，浏览当前可售商品。
2. 顾客进入商品详情页，查看描述、SKU 和履约方式。
3. 顾客选择一个 SKU，进入 checkout。
4. 顾客在 checkout 中：
   - 选择数量
   - 选择门店
   - 选择履约方式
   - 如为 `SHIPPING`，确认或修改地址 snapshot
5. 顾客提交订单。
6. 创建订单成功后，页面跳转到“我的订单”。
7. 顾客在“我的订单”中查看新订单摘要。
8. 顾客进入订单详情页，查看该订单的状态、商品、门店、自提信息或物流信息。

对应主路径可以概括为：

`商品列表 -> 商品详情 -> checkout -> 我的订单 -> 订单详情`

## 4. API 复用方式

当前 miniapp 没有新建专属后端接口，而是直接复用现有 API。

### 当前已复用接口

- `GET /products`
- `GET /products/:id`
- `GET /stores`
- `GET /customer/addresses`
- `POST /orders`
- `GET /orders`
- `GET /orders/:id`

### 当前复用原则

- miniapp 内部自行定义最小 TypeScript 类型
- 不在本阶段抽 shared-types
- 请求统一经过 `request.ts`
- 继续注入当前阶段固定请求头：
- `x-role: CUSTOMER`
- `x-user-id: demo-customer`

这样可以保证：

- 前后端 contract 保持一致
- miniapp 开工成本低
- 后续如果要抽共享类型，也仍有清晰边界

## 5. 当前仍然沿用的边界

Phase 2A 当前明确仍沿用以下边界：

- 顾客身份仍使用 `demo-customer`
- 当前没有登录态
- 当前没有微信授权
- 当前没有微信支付
- 当前没有订单支付动作闭环
- 地址仍然遵循 snapshot 原则
- checkout 只是读取默认地址带入，不把地址簿记录直接绑定到订单
- 不使用微信原生地址选择能力
- 不引入小程序端复杂状态管理

这些边界是当前阶段刻意保留的，不是遗漏。

## 6. 当前仍未完成内容

本阶段刻意没有做，且留给后续阶段处理的内容包括：

- 登录与顾客身份体系
- `openid / unionid`
- 微信授权接入
- 支付发起与支付回调
- 订单支付动作
- 取消订单动作
- 确认送达 / 确认收货动作
- 地址簿增强：
- 编辑
- 删除
- 多地址切换器
- 标签
- 小程序原生地址能力
- shared-types 抽取
- 更完整的 UI 组件体系
- 小程序发布与环境配置细节

这些内容不属于当前 `Phase 2A` 的阻塞项。

## 7. 手动验收步骤

### 本地启动

1. 启动 API：

```bash
npm run start -w @seafood/api
```

2. 启动 miniapp 编译：

```bash
cd apps/storefront-miniapp
npm run dev:weapp
```

3. 用微信开发者工具打开：

- `apps/storefront-miniapp/dist`

### 验收主链路

1. 进入商品列表页，确认可看到商品列表。
2. 点击任意商品进入商品详情页。
3. 在商品详情页选择一个 SKU。
4. 点击“去下单”，确认跳转到 checkout。
5. 在 checkout 中：
   - 调整数量
   - 选择门店
   - 切换 `STORE_PICKUP / SHIPPING`
   - 如为 `SHIPPING`，确认默认地址已带入或手动填写地址
6. 点击“提交订单”。
7. 确认出现“订单已创建”提示，并跳转到“我的订单”。
8. 在“我的订单”中确认可看到新订单摘要。
9. 点击“查看详情”进入订单详情页。
10. 确认订单详情中可看到：
    - 订单状态
    - 履约方式
    - 商品明细
    - 金额
    - 对应的自提信息或物流信息

### 静态编译验证

可使用：

```bash
cd apps/storefront-miniapp
npm run build:weapp
```

当前阶段已经通过该编译验证。

## 8. 下一阶段建议

下一阶段建议只推进到“登录 / 支付前准备”，不要直接展开完整实现。

更合理的最小目标：

- 先明确 miniapp 顾客身份接入方式
- 先明确登录后如何替换 `demo-customer`
- 先梳理支付前后的最小状态流转边界
- 先明确哪些能力继续复用现有 web / API contract

当前不建议下一阶段同时展开：

- 微信支付正式接入
- 复杂账号体系
- 小程序原生地址重构
- 复杂营销能力
- 大范围 shared-types 重构

## 9. 阶段结论

当前仓库已经可以把 `apps/storefront-miniapp` 视为：

- `Phase 2A` 最小小程序前端壳层已就绪
- miniapp 顾客主链路已具备可演示能力
- 当前版本已经达到“可演示、可继续迭代”的状态

如果需要一个更准确的阶段名，建议使用：

- 首选：`phase2a-miniapp-demo-ready`
- 备选：`phase2a-miniapp-shell-closed`

建议优先使用 `phase2a-miniapp-demo-ready`，它最准确表达当前状态：小程序壳层已经打通最小顾客主链路，但仍未进入登录、支付和微信能力接入阶段。
