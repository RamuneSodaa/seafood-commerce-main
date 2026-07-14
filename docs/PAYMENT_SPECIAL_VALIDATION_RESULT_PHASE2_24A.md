# Phase 2.24A 微信支付专项验收结果

阶段：Phase 2.24A_wechat_pay_real_device_special_validation  
生成时间：2026-06-14 16:10 CST  
性质：payment-validation-only / audit-only

## 总结

本阶段没有修改业务代码，没有修改 schema，没有执行 migration 或 seed。

由于当前本地环境缺少微信支付商户配置、回调配置和平台验签配置，且代码审计发现支付成功金额一致性校验缺失，Phase 2.24A 不能标记为真实支付通过。

当前结论：

```text
微信支付真实/准正式链路：BLOCKED
```

## 测试环境类型

当前环境：

```text
本地开发环境
API base: http://127.0.0.1:3000
数据库: 本地 PostgreSQL 127.0.0.1:5433
小程序 AppID: 与项目配置一致
微信支付商户配置: 缺失
notifyUrl: 缺失
```

没有调用真实微信支付。

## 支付创建结果

状态：`NOT_RUN / BLOCKED`

原因：

1. `WECHAT_PAY_MERCHANT_ID` 缺失。
2. `WECHAT_PAY_MERCHANT_SERIAL` 缺失。
3. `WECHAT_PAY_MERCHANT_PRIVATE_KEY_PEM` 缺失。
4. `WECHAT_PAY_NOTIFY_URL` 缺失。
5. 当前本地 API base 不是公网 HTTPS。

## 不用券支付链路结果

状态：`NOT_RUN / BLOCKED`

未创建真实微信支付订单，未调起微信支付。

## 用券支付链路结果

状态：`NOT_RUN / BLOCKED`

没有执行真实支付，因此未验证：

1. `LOCKED -> USED`
2. 真实回调后订单状态流转
3. 真实微信回调金额与订单金额一致性

## 用户取消支付测试结果

状态：`NOT_RUN / NEEDS_REAL_DEVICE`

代码审计结果：

1. 前端可识别 `requestPayment` cancel。
2. 顾客看到中文提示：`你已取消本次微信支付。`
3. 前端不调用后端 `markPaid`。
4. 理论上订单保持待支付，优惠券保持 `LOCKED`。

仍需真机验证支付拉起后用户取消的完整体验。

## 支付成功测试结果

状态：`NOT_RUN / BLOCKED`

阻塞原因：

1. 支付环境变量缺失。
2. 回调金额一致性 P0 风险未修。
3. 微信 v3 原生回调 payload 解密/映射未确认。

## 回调验签结果

状态：`NOT_RUN / BLOCKED`

代码审计结果：

1. 已有 RSA-SHA256 验签入口。
2. 已读取 rawBody 和微信回调签名头。
3. 会校验平台序列号。

阻塞原因：

1. `WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM` 缺失。
2. `WECHAT_PAY_PLATFORM_SERIAL` 缺失。
3. 未执行真实微信回调。

## 重复回调幂等结果

状态：`CODE_PATH_REVIEWED / NEEDS_SAFE_REPLAY_TOOL`

代码审计结果：

1. `PaymentRecord.paymentRef` 是唯一键。
2. 重复同一订单 paymentRef 返回 `IGNORED_DUPLICATE`。
3. 不会重复扣库存和重复用券。

未执行真实 replay。

## 支付成功后订单状态

状态：`CODE_PATH_REVIEWED / NOT_REAL_PAYMENT_VERIFIED`

代码路径：

1. 自提订单：`PENDING_PAYMENT -> PAID_PENDING_PREP`
2. 邮寄订单：`PENDING_PAYMENT -> PAID_PENDING_SHIPMENT`

未通过真实支付回调验证。

## 支付成功后优惠券状态

状态：`CODE_PATH_REVIEWED / NOT_REAL_PAYMENT_VERIFIED`

代码路径：

```text
CouponsService.useLockedCouponsForOrder(orderId)
LOCKED -> USED
```

未通过真实支付回调验证。

## 支付失败/取消后订单和优惠券状态

状态：`CODE_PATH_REVIEWED / NEEDS_REAL_DEVICE`

理论结果：

1. 用户取消支付不调用 `markPaid`。
2. 订单保持 `PENDING_PAYMENT`。
3. 已选优惠券保持 `LOCKED`。
4. 顾客可继续支付或取消订单。
5. 取消订单后优惠券释放为 `CLAIMED`。

## 金额一致性结果

状态：`FAIL / P0`

发现：

当前支付成功处理未见强制校验：

```text
paidAmountCents === order.totalAmountCents
```

风险：

支付回调金额不一致时仍可能标记订单已支付。

上线前必须修复。

## 是否出现 NO_AUTH / 商户限制

状态：`NOT_RUN`

本阶段没有调用微信支付接口，因此没有出现新的 `NO_AUTH` 或商户限制返回。

历史风险仍保留：

1. 商户支付权限未完全开通时可能返回 `NO_AUTH`。
2. 当前前端已做中文友好提示映射。
3. 真机/准正式环境仍需实际验证。

## 问题分级

| 级别 | 数量 | 问题 |
| --- | ---: | --- |
| P0 | 1 | 支付成功金额未强制等于订单应付金额 |
| P1 | 1 | 微信 v3 原生回调 `resource` 解密与业务字段映射未确认 |
| P2 | 1 | 无安全 replay 工具，重复回调只完成代码审计 |
| P3 | 0 | 无 |

## 下一阶段建议

建议不要直接进入真实支付验收，先执行：

```text
Phase 2.24B_payment_amount_and_wechat_v3_callback_mapping_fix
```

最小修复范围：

1. 支付回调金额与订单金额强校验。
2. 微信支付 v3 原生回调 `resource` 解密与字段映射。
3. 脱敏支付回调日志。
4. 安全重复回调 replay 验证工具或准正式 replay 流程。
5. 完成后再进入真机支付创建、取消支付、支付成功、重复回调专项验收。

## Phase 2.24B 修复状态更新

Phase 2.24A 发现的代码级 P0/P1 已进入 Phase 2.24B 修复：

1. 已增加支付金额强校验：`paidAmountCents === order.totalAmountCents`。
2. 已支持微信支付 v3 原生 `resource` AES-256-GCM 解密。
3. 已支持 `out_trade_no / transaction_id / amount.total / trade_state` 字段映射。
4. 已拒绝非 `SUCCESS` 交易状态。
5. 已增加原生微信回调 body 入口兼容。
6. 已增加本地安全 replay/harness 测试。

注意：

真实微信支付仍未调用，商户支付配置、公网 HTTPS notifyUrl、真机支付创建、真实回调验签和真实重复回调仍需 Phase 2.24C 验收。
