# Phase 2B Login Payment Prep Ready

本文档用于定义 miniapp 从当前 `demo customer` 演示态，过渡到未来“真实顾客身份 + 微信支付接入”之前，必须先收口的边界。

当前目标不是直接实现登录或支付，而是把后续实现时**哪些接口、哪些状态、哪些语义现在不能乱动**先钉死。

这是一份接入前准备说明，不是完整方案文档。

## 1. 当前真实现状

### 1.1 web / miniapp 当前如何标识 CUSTOMER

当前 storefront web 和 miniapp 都没有真实顾客身份体系，而是通过请求头直接标识顾客角色。

#### storefront web

当前请求层会固定注入：

- `x-role: CUSTOMER`
- `x-user-id: demo-customer`

也就是说，web storefront 当前所有顾客侧请求，本质上都在以 `demo-customer` 身份访问接口。

#### miniapp

当前 miniapp 的 `request.ts` 同样固定注入：

- `x-role: CUSTOMER`
- `x-user-id: demo-customer`

因此，miniapp 当前也没有真实登录态，只是沿用同一个演示顾客身份访问现有 API。

### 1.2 哪些页面 / API 仍依赖 demo customer

当前所有顾客侧页面，只要会请求顾客域数据，就仍然依赖 `demo-customer`。

#### storefront web 侧

典型包括：

- 商品列表 / 商品详情
- checkout
- 我的订单 / 订单详情
- 我的地址

其中真正受顾客身份影响的 API 主要是：

- `GET /orders`
- `GET /orders/:id`
- `POST /orders`
- `POST /orders/:id/mark-paid`
- `POST /orders/:id/cancel`
- `GET /customer/addresses`
- `POST /customer/addresses`
- `POST /customer/addresses/:id/set-default`

#### miniapp 侧

当前 miniapp 主链路页面也依赖相同顾客身份：

- 商品列表
- 商品详情
- checkout
- 我的订单
- 订单详情

当前 miniapp 直接复用的顾客域 API 包括：

- `GET /products`
- `GET /products/:id`
- `GET /stores`
- `GET /customer/addresses`
- `POST /orders`
- `GET /orders`
- `GET /orders/:id`

### 1.3 当前支付处于什么阶段

当前支付仍然属于演示 / 模拟态，不是真实微信支付。

当前真实情况是：

- 创建订单后，订单先进入 `PENDING_PAYMENT`
- 之后通过现有 `POST /orders/:id/mark-paid` 把订单推进到“已支付后的待履约状态”
- 该接口当前本质上是一个“支付已完成标记”入口，不是实际拉起支付

也就是说，当前系统里：

- 没有微信支付调起
- 没有支付单独签名流程
- 没有支付回调验签
- 没有基于微信交易号的真实支付确认

## 2. 登录接入前必须保持不变的接口边界

后续接入真实顾客身份前，以下边界建议先保持不变。

### 2.1 哪些 API 路径先不要改

当前建议保持以下路径不变：

- `GET /products`
- `GET /products/:id`
- `GET /stores`
- `POST /orders`
- `GET /orders`
- `GET /orders/:id`
- `POST /orders/:id/mark-paid`
- `POST /orders/:id/cancel`
- `GET /customer/addresses`
- `POST /customer/addresses`
- `POST /customer/addresses/:id/set-default`

原因：

- web storefront 已经依赖这些路径
- miniapp 当前也已经依赖这些路径
- 当前主链路和测试、脚本、演示路径已经围绕这组路径稳定下来

登录接入前如果先改路径，会把“身份接入”问题和“接口重构”问题混在一起，不利于稳定推进。

### 2.2 哪些 payload / response contract 先不要动

当前建议先不要改以下关键 contract：

#### 订单创建

`POST /orders`

当前关键请求结构保持不变：

- `storeId`
- `fulfillmentType`
- `items: [{ skuId, quantity }]`
- `pickupDate`
- `pickupTimeSlot`
- `shippingAddress`

其中 `shippingAddress` 结构先不要改：

- `receiverName`
- `phone`
- `province`
- `city`
- `district`
- `detail`
- `postalCode`

#### 订单列表 / 订单详情

当前订单响应里以下语义先不要改：

- `status`
- `fulfillmentType`
- `items`
- `shipment`
- `pickupRecord`
- `shippingAddress`
- `totalAmountCents`

#### 地址相关

地址 API 当前最小 contract 也先不要改字段命名：

- `receiverName`
- `phone`
- `province`
- `city`
- `district`
- `detail`
- `postalCode`
- `isDefault`

### 2.3 订单 snapshot 原则不能动哪些部分

以下原则在登录接入前、支付接入前都不要改变：

#### 地址 snapshot 原则

- 订单创建时，`shippingAddress` 必须冻结为订单快照
- 后续地址簿变化，不能反向修改历史订单地址

#### 订单项 snapshot 原则

- 订单创建时的 `items`、数量、单价语义保持不变
- 不要把订单直接绑定到一个“可变购物车”结构

#### 履约快照原则

- `fulfillmentType` 一旦入单，不要在后续顾客身份接入阶段重新解释
- 自提与发货的后续处理差异仍然沿用现有业务流

## 3. 从 demo customer 过渡到真实顾客身份的最小路线

### 3.1 当前 `x-user-id: demo-customer` 将来怎么替换

最小过渡思路建议分两步，而不是一步切到完整账号体系。

#### 第一步：保留“请求层注入顾客身份”的机制

先不要立刻重写所有业务 API，也不要先引入复杂 session。

建议先把现在硬编码的：

- `x-user-id: demo-customer`

替换成：

- 从统一身份提供层读取“当前顾客标识”

也就是说，**先抽身份来源，不先改业务接口**。

#### 第二步：再把真实顾客标识接到统一身份提供层

等后续真实登录方式明确后，再让该身份提供层返回真实顾客 ID，而不是 `demo-customer`。

### 3.2 是先保持自定义 header 过渡，还是引入 token / session

基于当前仓库状态，更建议先走“自定义 header 过渡”，再决定是否升级到 token / session。

原因：

- 后端当前已经围绕 `x-role` 和 `x-user-id` 做了权限边界
- 顾客订单访问控制已经依赖这两个字段
- 如果现在直接切 token / session，会同时改动：
- 请求封装
- 鉴权方式
- API 网关 / 中间件思路
- 调试方式

这会让“登录接入前准备”阶段变得过重。

因此更稳的过渡路线是：

1. 先保持 `x-role: CUSTOMER`
2. 先把 `x-user-id` 从硬编码改成“可配置 / 可替换的当前顾客标识”
3. 后续再决定该标识来自：
   - 登录态换取的用户信息
   - token 解析结果
   - session 映射结果

### 3.3 miniapp 接真实身份后，最小需要影响哪些请求封装层

最小应只先影响请求封装层，而不是所有页面业务代码。

优先影响：

- `apps/storefront-miniapp/src/lib/request.ts`
- `apps/storefront-web/src/lib/api.ts` 里的统一 request 层

建议目标是：

- 页面代码仍然继续调用 `getOrders()` / `createOrder()` / `getCustomerAddresses()`
- 不让页面直接关心“当前顾客是谁”
- 身份替换逻辑尽量收敛在 request 层或其上游配置层

## 4. 支付接入前需要先确认的最小状态流转约束

### 4.1 当前订单创建后的状态

当前订单创建后，状态是：

- `PENDING_PAYMENT`

这个语义现在不要改。

它表示：

- 订单已创建
- 但尚未完成支付确认

### 4.2 当前模拟支付如何推进状态

当前通过：

- `POST /orders/:id/mark-paid`

推进状态。

当前行为是：

- 从 `PENDING_PAYMENT` 进入支付后待履约状态
- 如果是自提单，进入 `PAID_PENDING_PREP`
- 如果是发货单，进入 `PAID_PENDING_SHIPMENT`

同时现有逻辑还会：

- 创建支付记录
- 预留库存
- 写订单状态日志
- 写库存日志

因此 `mark-paid` 当前不只是“改订单状态”，它还是：

- 支付确认后的业务触发点

### 4.3 未来真实支付接入后，最小要映射到哪些现有状态

未来真实支付接入后，最小仍建议沿用现有状态映射：

- 下单成功但未支付：`PENDING_PAYMENT`
- 支付确认成功后：
- 自提单 -> `PAID_PENDING_PREP`
- 发货单 -> `PAID_PENDING_SHIPMENT`

也就是说，未来真实支付接入时，最小目标不是改状态体系，而是把“真实支付成功确认”映射到当前已有的 `mark-paid` 语义边界。

### 4.4 哪些状态名和业务语义现在不要改

以下状态及其业务语义现在建议保持不变：

- `PENDING_PAYMENT`
- `PAID_PENDING_PREP`
- `READY_FOR_PICKUP`
- `COMPLETED`
- `PAID_PENDING_SHIPMENT`
- `SHIPPED`
- `DELIVERED`
- `CANCELLED`

尤其不要在支付接入前就改：

- 状态名
- 支付后进入的两个待履约分支
- 自提 / 发货的语义分界

否则会直接影响：

- web storefront
- miniapp
- admin workbench
- 现有测试
- 演示脚本

## 5. miniapp 环境准备约束

当前虽然不展开完整发布流程，但以下环境边界现在就要提前考虑。

### 5.1 baseURL 不能长期写死为单一本地地址

当前 miniapp 的 API baseURL 仍是本地开发配置。

后续在身份接入和支付接入前，至少要先具备：

- 本地开发 API 地址
- 测试环境 API 地址
- 未来生产环境 API 地址

也就是说，baseURL 需要有最小环境切换能力，不能长期只依赖一个硬编码本地地址。

### 5.2 HTTPS 与合法域名需要提前纳入约束

即使当前还不做正式发布，后续真实身份和支付接入时，也必须提前考虑：

- API 域名
- HTTPS
- 小程序请求域名约束

这不需要现在就完成发布流程，但需要明确：

- 未来不能假设所有请求都长期跑在 `127.0.0.1`

### 5.3 本地调试与测试环境切换要尽量收敛在配置层

当前更合理的准备方向是：

- 不让页面代码自己判断环境
- 不让每个 API 方法各自拼接环境地址
- 环境切换尽量收敛在 config / request 层

这样后续登录接入或支付接入时，改动面会更小。

## 6. 下一步最小代码任务建议

建议的下一步最小代码任务只有一个：

### 把 web 与 miniapp 的“当前顾客身份注入”从硬编码改成统一可替换配置层

目标不是接真实登录，而是先做一层最小抽象：

- 当前默认仍然返回 `demo-customer`
- 但页面和 API 方法不再直接写死该值
- miniapp 与 web 的 request 层都通过统一入口拿到：
- 当前 role
- 当前 userId

这样做的价值是：

- 不改业务 API
- 不改页面逻辑
- 不碰登录实现
- 但能先把“未来真实顾客身份替换点”收口出来

相比之下，现在直接去做完整登录或完整支付实现，风险更高、范围更散。

## 7. 明确本阶段暂不做什么

本阶段明确不做以下内容：

- `openid / unionid` 真实接入
- 微信登录实现
- 微信支付调起
- 支付回调处理实现
- 小程序发布流程
- 风控体系
- 营销能力
- 消息通知
- 完整账号体系设计
- 大范围鉴权重构

这些内容都不属于当前“接入前边界收口”的范围。

## 8. 阶段结论

当前更重要的不是立刻开做登录或支付，而是先把下面三件事钉死：

- 顾客域 API 路径与核心 contract 先不改
- `demo-customer` 的替换点先收敛到请求层
- 真实支付未来仍映射到当前已有订单状态体系，而不是先改状态模型

如果需要一个更准确的阶段名，建议使用：

- 首选：`phase2b-login-payment-prep-ready`
- 备选：`phase2b-auth-pay-boundary-locked`

建议优先使用 `phase2b-login-payment-prep-ready`，它最准确表达当前状态：还没开始真实登录和支付实现，但接入前最关键的接口、身份和状态边界已经先被明确固定。
