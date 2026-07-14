# Phase 2.24A 支付回调验签与幂等审查

阶段：Phase 2.24A_wechat_pay_real_device_special_validation  
性质：只读审查，不伪造支付成功

## 结论

当前代码已有回调签名校验入口和 `paymentRef` 幂等机制，重复同一支付流水不会重复扣库存或重复用券。

但真实微信支付回调验收仍不能放行，原因：

1. 当前环境缺少微信支付平台公钥和平台序列号，无法真实验签。
2. 当前回调 payload 业务映射未覆盖微信 v3 原生加密 `resource` 解密。
3. 当前支付成功业务流未强制校验 `paidAmountCents === order.totalAmountCents`。

## 验签路径

文件：

```text
apps/api/src/modules/orders/orders.controller.ts
apps/api/src/modules/orders/miniapp-payment-callback-verification.service.ts
apps/api/src/main.ts
```

路由：

```text
POST /orders/miniapp-payment-callback
```

验签输入：

```text
rawBody
Wechatpay-Timestamp
Wechatpay-Nonce
Wechatpay-Serial
Wechatpay-Signature
```

配置：

```text
WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM
WECHAT_PAY_PLATFORM_SERIAL
```

当前环境配置状态：

```text
WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM: missing
WECHAT_PAY_PLATFORM_SERIAL: missing
```

## 幂等机制

Prisma 模型：

```text
PaymentRecord.paymentRef @unique
```

业务逻辑：

1. 支付成功处理前查 `findPaymentByRef(paymentRef)`。
2. 如果 paymentRef 已存在且属于同一订单，返回 `IGNORED_DUPLICATE`。
3. 如果 paymentRef 已存在但属于其他订单，抛错。
4. 首次处理才会创建 PaymentRecord、扣库存、改订单状态、用券。

该机制可以覆盖微信重复回调的常见幂等要求。

## 优惠券状态变化

创建订单：

```text
CLAIMED -> LOCKED
```

支付成功：

```text
LOCKED -> USED
```

取消订单或超时取消：

```text
LOCKED -> CLAIMED
```

支付成功路径调用：

```text
CouponsService.useLockedCouponsForOrder(orderId)
```

取消/超时路径调用：

```text
CouponsService.releaseLockedCouponsForOrder(orderId)
```

## 回调金额一致性

当前未见强校验：

```text
paidAmountCents === order.totalAmountCents
```

风险：

如果业务层收到异常金额但仍执行 `markPaid`，订单会被标记为已支付并触发库存、优惠券和邀请奖励流转。

等级：P0。

上线前必须补齐。

## 回调 payload 格式

当前业务提取函数要求：

```text
callbackPayload.merchantOrderNo
callbackPayload.transactionId
callbackPayload.paidAmountCents
```

未见微信 v3 原生回调 `resource` 解密逻辑。

风险：

1. 如果微信回调原文直接进入该 route，业务字段缺失，回调无法完成。
2. 如果存在外部网关做了解密和字段转换，需要明确写入部署架构文档，否则生产不可审计。

等级：P1；若无外部解密网关则为 P0。

## 已取消订单收到支付回调

当前 `markPaid` 仅允许：

```text
PENDING_PAYMENT -> PAID_PENDING_PREP / PAID_PENDING_SHIPMENT
```

如果订单已取消，回调会被拒绝，不会用券或扣库存。

注意：

真实支付场景中用户可能支付后回调延迟，而前端或超时机制已取消订单。该边界需要在准正式环境专项验收，并设计人工/客服处理方案。

## 重复回调测试状态

本阶段没有伪造支付成功，也没有执行未验签 replay。

状态：

```text
NEEDS_SAFE_REPLAY_TOOL
```

建议后续建立：

1. 使用真实微信支付回调样本的脱敏 replay。
2. 或在准正式环境通过微信平台重复通知机制验证。
3. replay 必须通过真实签名验证或使用明确隔离的测试 harness。

