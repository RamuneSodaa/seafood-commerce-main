# Phase 2.24C 微信支付真机 gate 结果

生成时间：2026-06-14 16:41 CST  
阶段：Phase 2.24C_wechat_pay_env_preflight_and_real_device_gate  
性质：真实支付 gate。环境未通过时不调用真实微信支付。

## 总结

本阶段没有调用真实微信支付。原因是微信支付环境变量和公网 HTTPS 回调地址不完整。

本阶段没有修改业务代码，没有修改 schema，没有执行 migration，没有执行 seed，没有伪造支付成功。

## Gate 状态

| 项目 | 结果 |
| --- | --- |
| 支付环境是否完整 | BLOCKED |
| notifyUrl 是否 HTTPS 公网可达 | BLOCKED，当前缺失 |
| rawBody 是否代码层面确认可用 | 是 |
| 是否调用真实微信支付 | 否 |
| 是否创建真实微信预支付参数 | 否 |
| 是否真机拉起微信支付 | 否 |
| 是否发生真实微信回调 | 否 |

## 支付创建预检

由于缺少以下配置，本阶段未调用 `create-miniapp-payment`：

1. `WECHAT_PAY_MERCHANT_ID`
2. `WECHAT_PAY_MERCHANT_SERIAL`
3. `WECHAT_PAY_MERCHANT_PRIVATE_KEY_PEM`
4. `WECHAT_PAY_NOTIFY_URL`
5. `WECHAT_PAY_API_V3_KEY`
6. `WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM`
7. `WECHAT_PAY_PLATFORM_SERIAL`

因此未出现 `NO_AUTH`、商户限制、AppID/MchID 不匹配或签名错误；这些场景尚未进入真实接口。

## 用户取消支付测试

状态：`NOT_RUN`

原因：支付创建未通过环境 gate，未调起微信支付。

待验证要求：

1. 用户取消支付后订单仍为待支付。
2. 锁定优惠券保持 `LOCKED`。
3. 不标记已支付。
4. 用户可继续支付或取消订单。
5. 用户取消订单后优惠券释放回 `CLAIMED`。

## 支付成功测试

状态：`NOT_RUN`

原因：支付创建未通过环境 gate，未调起微信支付。

待验证要求：

1. 真实微信支付成功。
2. 真实回调到达公网 HTTPS API。
3. 回调验签通过。
4. `resource` 解密通过。
5. `trade_state=SUCCESS`。
6. `amount.total === order.totalAmountCents`。
7. 自提订单进入 `PAID_PENDING_PREP`。
8. 邮寄订单进入 `PAID_PENDING_SHIPMENT`。
9. 优惠券从 `LOCKED` 变为 `USED`。
10. 不重复扣库存，不重复用券。

## 金额一致性

真实支付未执行，因此真实金额一致性为 `NOT_RUN`。

代码层面 Phase 2.24B 已补齐：

```text
paidAmountCents === order.totalAmountCents
```

该逻辑已通过本地 replay/harness 测试，但仍需要真实微信回调验证。

## 回调延迟期间误取消风险

真实支付未执行，因此无法观察“支付成功但回调延迟期间用户是否还能取消订单”。

风险记录：`P2`。

下一阶段真机验收时必须重点观察：

1. 支付完成后、回调未到前订单详情是否仍显示待支付。
2. 此时是否允许点击取消订单。
3. 如果允许，应升级为 `P1` 并设计 `PAYING` 状态或支付中保护。

## 重复回调幂等

真实微信重复通知未覆盖。

Phase 2.24B 已通过代码 replay/harness 覆盖：

1. 同一 transaction_id 重复回调幂等。
2. 金额不一致拒绝。
3. 非 `SUCCESS` 不标记支付成功。
4. resource 解密失败拒绝。

真实微信平台重复通知仍需准正式或正式前验证。

## 问题分级

| 等级 | 数量 | 说明 |
| --- | ---: | --- |
| P0 | 0 | 未发现代码级金额/验签/状态 P0；真实环境未进入 |
| P1 | 0 | 未执行真机支付，暂无真机 P1 结论 |
| P2 | 2 | 支付环境缺失；真实重复回调与回调延迟误取消仍未验收 |
| P3 | 0 | 暂无 |

## 结论

当前不能声明真实微信支付通过。  
当前只能声明：支付安全代码路径在本地已修复，真实支付被环境 gate 正确阻断。

下一阶段应先补齐安全支付环境与公网 HTTPS notifyUrl，再进行低额真机专项验收。

## Phase 2.24D 追加引用

Phase 2.24D 已新增本地 env 预检脚本：

```text
scripts/check-wechat-pay-env-local.js
```

当前脚本 gate 结果仍为：

```text
BLOCKED_ENV_MISSING
```

因此 Phase 2.24C 的真实支付结论保持不变：未调用真实微信支付，未创建真实 prepay，未执行真机支付。
