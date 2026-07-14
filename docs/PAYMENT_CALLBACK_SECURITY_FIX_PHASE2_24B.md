# Phase 2.24B 支付回调安全修复说明

阶段：Phase 2.24B_payment_amount_and_wechat_v3_callback_mapping_fix  
生成时间：2026-06-14  
性质：支付回调安全小修，不调用真实微信支付

## 结论

本阶段已修复 Phase 2.24A 发现的支付回调安全阻塞点：

1. 支付成功业务入口增加金额强校验。
2. 支持微信支付 API v3 原生回调 `resource` 解密。
3. 支持从微信原生交易对象映射内部字段。
4. 非 `SUCCESS` 交易状态不会标记已支付。
5. 增加脱敏金额不一致安全日志。
6. 增加 replay/harness 测试覆盖金额不一致、解密失败、非 SUCCESS、重复回调幂等和原生 body 入口。

本阶段没有修改 `prisma/schema.prisma`，没有执行 migration，未执行 seed，没有调用真实微信支付。

## 修改范围

业务代码：

```text
apps/api/src/modules/orders/miniapp-payment-callback-verification.service.ts
apps/api/src/modules/orders/order-workflow.service.ts
apps/api/src/modules/orders/orders.controller.ts
apps/api/src/modules/orders/dto/order-workflow.dto.ts
```

测试：

```text
apps/api/test/order-workflow.service.smoke.spec.ts
apps/api/test/orders.controller.spec.ts
apps/api/test/order-workflow.pg.integration.spec.ts
apps/api/test/order-pricing.service.spec.ts
```

## 金额强校验

支付成功处理入口：

```text
OrderWorkflowService.markPaid(orderId, paymentRef, paidAmountCents)
```

新增规则：

```text
order.totalAmountCents > 0
paidAmountCents > 0
paidAmountCents === order.totalAmountCents
```

金额不一致或 0 元支付时：

1. 不创建 `PaymentRecord`。
2. 不扣库存。
3. 不使用优惠券。
4. 不改变订单状态。
5. 抛出明确错误：`Payment amount does not match order total`。
6. 只记录脱敏日志。

脱敏日志字段：

```text
orderId: 仅后 6 位
paymentRef: 仅后 8 位
expectedAmountCents
actualAmountCents
```

不记录 openid、完整 transactionId、完整回调体、密钥、证书、手机号或其他隐私。

## 为什么金额强校验是 P0

支付回调验签只能证明回调来自可信支付方，不能替代业务金额校验。

如果不校验回调金额等于订单应付金额，异常金额也可能触发：

1. 订单改为已支付。
2. 库存扣减。
3. 优惠券 `LOCKED -> USED`。
4. 邀请首单奖励触发。

因此金额不一致必须在任何业务副作用前拒绝。

## 微信 v3 resource 解密流程

支持原生结构：

```text
id
create_time
event_type
resource_type
resource.algorithm
resource.ciphertext
resource.associated_data
resource.nonce
```

处理顺序：

1. 使用 rawBody 和微信支付签名头验签。
2. 验签通过后检查 `resource.algorithm`。
3. 仅支持 `AEAD_AES_256_GCM`。
4. 读取 `WECHAT_PAY_API_V3_KEY`。
5. 校验 API v3 key 为 32 bytes。
6. 使用 AES-256-GCM 解密 `resource.ciphertext`。
7. 解密失败则拒绝业务处理。
8. 解密成功后映射交易字段。

不会记录 API v3 key、ciphertext、完整解密明文或完整 raw callback。

## 字段映射表

| 微信 v3 字段 | 内部字段 |
| --- | --- |
| `out_trade_no` | `merchantOrderNo` / `orderNo` |
| `transaction_id` | `paymentRef` |
| `amount.total` | `paidAmountCents` |
| `trade_state` | 仅 `SUCCESS` 进入支付成功业务 |
| `appid` | direct 模式 AppID 一致性检查 |
| `mchid` | direct 模式商户号一致性检查 |
| `sub_appid` | partner 模式小程序 AppID 一致性检查 |
| `sp_mchid` | partner 模式服务商商户号一致性检查 |
| `sub_mchid` | partner 模式子商户号一致性检查 |

兼容旧测试/包装式结构：

```text
merchantOrderNo
transactionId
paidAmountCents
```

## direct / partner 模式说明

当前代码支持 direct 与 partner 创建支付参数。

回调映射中：

1. `WECHAT_PAY_MODE=partner` 时检查 `sp_mchid`、`sub_mchid`、`sub_appid`。
2. 未设置或 `direct` 时检查 `mchid`、`appid`。
3. 只有相关 env 存在且回调字段存在时才做一致性比较，避免本地无支付配置测试被误伤。

partner 模式仍需在后续准正式环境真机验收。

## 回调入口兼容

真实微信 v3 callback body 不包含本项目早期的 `provider/callbackPayload` 包装。

本阶段修复：

1. `MiniappPaymentCallbackDto.provider` 变为可选。
2. controller 缺省 provider 为 `wechat`。
3. 当 `callbackPayload` 缺失时，controller 从 `rawBody` 解析原生微信回调 JSON 作为业务 payload。
4. 签名验证仍使用原始 rawBody。

## 幂等策略

幂等键：

```text
PaymentRecord.paymentRef @unique
```

行为：

1. 首次 SUCCESS 回调：应用支付成功，写 PaymentRecord，扣库存，用券。
2. 第二次同一 transaction_id 且同一订单：返回 `IGNORED_DUPLICATE`。
3. 同一 transaction_id 指向不同订单：拒绝。
4. 非待支付订单收到新 paymentRef：拒绝，不扣库存、不用券。

## 仍需真机验证

本阶段没有调用真实微信支付。

后续 Phase 2.24C 必须验证：

1. 真实商户参数创建支付。
2. 真机拉起微信支付。
3. 用户取消支付。
4. 真实支付成功。
5. 微信真实回调验签。
6. 真实 resource 解密。
7. 金额一致性。
8. 重复回调幂等。
9. 支付成功后券 `LOCKED -> USED`。

## 仍缺配置

当前本地 `.local/env/wechat-miniapp.local` 仍缺：

```text
WECHAT_PAY_MERCHANT_ID
WECHAT_PAY_MERCHANT_SERIAL
WECHAT_PAY_MERCHANT_PRIVATE_KEY_PEM
WECHAT_PAY_NOTIFY_URL
WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM
WECHAT_PAY_PLATFORM_SERIAL
WECHAT_PAY_API_V3_KEY
```

因此本阶段只能证明代码路径安全，不能证明真实商户支付可用。

