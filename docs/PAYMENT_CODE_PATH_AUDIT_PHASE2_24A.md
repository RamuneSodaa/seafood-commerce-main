# Phase 2.24A 支付代码路径审计

阶段：Phase 2.24A_wechat_pay_real_device_special_validation  
性质：只读代码审计，不修改支付代码

## 结论

当前代码已经具备微信小程序 JSAPI 支付创建、前端调起、回调验签入口、订单状态流转、优惠券核销和重复回调幂等的基础路径。

但进入真实支付验收前存在两个必须处理的风险：

1. `markPaid` 当前未校验 `paidAmountCents === order.totalAmountCents`，如果回调金额异常但验签通过，存在错误标记已支付的 P0 风险。
2. 当前回调业务映射期望 `callbackPayload.merchantOrderNo / transactionId / paidAmountCents` 已经是业务字段，未看到对微信支付 v3 原生 `resource` 加密回调体的解密和字段映射。若微信直接打到该路由，回调将无法按现有字段解析，属于 P1/P0 上线阻塞风险。

## 后端创建支付参数

入口：

```text
POST /orders/:id/create-miniapp-payment
```

文件：

```text
apps/api/src/modules/orders/orders.controller.ts
apps/api/src/modules/orders/order-workflow.service.ts
apps/api/src/modules/orders/wechat-miniapp-payment-create.client.ts
```

保护方式：

```text
CustomerAuthArtifactGuard
```

核心流程：

1. 顾客必须是真实微信登录态。
2. 订单必须是 `PENDING_PAYMENT`。
3. 从订单 `customerId` 中提取微信 openId。
4. 使用订单后端存储的 `order.totalAmountCents` 创建微信支付订单。
5. 返回小程序 `requestPayment` 所需参数。

金额来源：后端订单 `totalAmountCents`，不是前端金额。

## 支付模式

代码支持：

1. direct 模式：
   - `WECHAT_PAY_MERCHANT_ID`
   - `WECHAT_PAY_MERCHANT_SERIAL`
   - `WECHAT_PAY_MERCHANT_PRIVATE_KEY_PEM`
2. partner 模式：
   - `WECHAT_PAY_SP_MERCHANT_ID`
   - `WECHAT_PAY_SP_MERCHANT_SERIAL`
   - `WECHAT_PAY_SP_MERCHANT_PRIVATE_KEY_PEM`
   - `WECHAT_PAY_SUB_MERCHANT_ID`

当前环境未配置上述支付变量，无法真实创建支付。

## 小程序调起支付路径

文件：

```text
apps/storefront-miniapp/src/pages/order-detail/index.tsx
apps/storefront-miniapp/src/lib/payment-transition.ts
apps/storefront-miniapp/src/lib/wechat-payment-launch.ts
apps/storefront-miniapp/src/lib/api.ts
```

路径：

1. 订单详情点击立即支付。
2. `runCustomerPaymentTransition({ orderId, paidAmountCents })`
3. 真登录态调用 `createMiniappPayment(orderId)`。
4. `Taro.requestPayment(...)` 调起微信支付。
5. 支付拉起后轮询刷新订单详情。

注意：

非真登录态仍存在旧 mock `markPaid` 分支，但真实小程序登录态会走微信支付创建路径。

## 用户取消支付

文件：

```text
apps/storefront-miniapp/src/lib/wechat-payment-launch.ts
```

逻辑：

1. `Taro.requestPayment` 抛出 `cancel` 类 errMsg。
2. 前端返回：

```text
你已取消本次微信支付。
```

3. 不调用后端 `markPaid`。
4. 订单理论上保持 `PENDING_PAYMENT`。
5. 优惠券理论上保持 `LOCKED`，直到顾客取消订单或超时释放。

本阶段未真机调起，因此该路径仍需人工真机截图验证。

## 微信支付回调路由

入口：

```text
POST /orders/miniapp-payment-callback
```

文件：

```text
apps/api/src/modules/orders/orders.controller.ts
apps/api/src/modules/orders/miniapp-payment-callback-verification.service.ts
apps/api/src/main.ts
```

`main.ts` 已开启：

```text
rawBody: true
```

回调验签读取：

```text
Wechatpay-Timestamp
Wechatpay-Nonce
Wechatpay-Serial
Wechatpay-Signature
rawBody
```

验签配置：

```text
WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM
WECHAT_PAY_PLATFORM_SERIAL
```

当前环境未配置平台公钥与平台序列号，因此无法完成真实回调验签。

## 支付成功后订单状态流转

文件：

```text
apps/api/src/modules/orders/order-workflow.service.ts
```

方法：

```text
markPaid(orderId, paymentRef, paidAmountCents)
```

当前行为：

1. 锁订单。
2. 查找 `PaymentRecord.paymentRef`。
3. 重复同一订单 paymentRef 返回 `IGNORED_DUPLICATE`。
4. 重复 paymentRef 指向其他订单时报错。
5. 仅允许 `PENDING_PAYMENT` 进入支付成功流转。
6. 校验库存可用。
7. 创建 `PaymentRecord`。
8. 扣减可售库存并增加预留库存。
9. 状态流转：
   - 自提：`PAID_PENDING_PREP`
   - 邮寄：`PAID_PENDING_SHIPMENT`
10. 写订单状态日志与库存日志。
11. 调用 `useLockedCouponsForOrder` 将锁定券置为 `USED`。
12. 触发邀请首单奖励逻辑。

## 重复回调幂等

幂等依据：

```text
PaymentRecord.paymentRef @unique
```

重复同一支付流水：

```text
IGNORED_DUPLICATE
```

可防止重复扣库存和重复用券。

限制：

本阶段未执行真实微信回调 replay；安全 replay 工具尚未建立，重复回调真验收标记为 `NEEDS_SAFE_REPLAY_TOOL`。

## 金额一致性风险

当前风险：

```text
markPaid(orderId, paymentRef, paidAmountCents)
```

未发现如下强校验：

```text
if (paidAmountCents !== order.totalAmountCents) reject
```

这意味着：如果验签通过但业务映射传入的支付金额与订单应付金额不一致，当前代码仍会继续创建 PaymentRecord、扣库存、用券并改订单状态。

问题等级：P0。

上线前建议：

1. 在 `markPaid` 或回调业务映射后立即校验回调金额等于订单 `totalAmountCents`。
2. 金额不一致时拒绝标记已支付。
3. 记录脱敏安全日志。
4. 对管理端 `mark-paid` 也应明确人工操作边界，避免绕过真实支付金额校验。

## 微信 v3 原生回调 payload 映射风险

当前业务映射期望字段：

```text
merchantOrderNo
transactionId
paidAmountCents
```

微信支付 v3 原生回调通常是包含 `resource` 的加密报文，需要使用 API v3 key 解密后读取交易字段。

本阶段未看到：

1. `resource.associated_data`
2. `resource.nonce`
3. `resource.ciphertext`
4. AES-GCM 解密
5. 从解密后对象映射 `out_trade_no`、`transaction_id`、`amount.total`

问题等级：P1，若当前回调路由直接暴露给微信则会变成 P0 阻塞。

## 异常路径审计

| 异常 | 当前代码判断 |
| --- | --- |
| 支付创建失败 | 后端抛 `BadGatewayException`，前端对 `NO_AUTH`/商户限制做友好文案映射 |
| 用户取消支付 | 前端返回取消文案，不改订单 |
| 回调金额不一致 | 当前未见拒绝逻辑，P0 |
| 已取消订单收到支付回调 | `markPaid` 仅允许 `PENDING_PAYMENT`，会拒绝非待支付订单 |
| 优惠券已释放后收到支付成功 | 若订单已取消则拒绝；若仍待支付但券已异常释放，需后续专项测试 |
| 重复回调 | 同 paymentRef 幂等，避免重复扣库存/用券 |

## Gate 建议

在进入真机真实支付前，建议先进入一个最小修复阶段：

```text
Phase 2.24B_payment_amount_and_wechat_v3_callback_mapping_fix
```

优先修：

1. 回调金额与订单金额强校验。
2. 微信支付 v3 原生回调 resource 解密与字段映射。
3. 脱敏回调日志。
4. 安全 replay 测试工具或测试脚本。

