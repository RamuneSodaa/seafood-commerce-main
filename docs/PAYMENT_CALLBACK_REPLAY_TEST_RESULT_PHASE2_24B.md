# Phase 2.24B 支付回调 Replay / Harness 测试结果

阶段：Phase 2.24B_payment_amount_and_wechat_v3_callback_mapping_fix  
性质：本地安全测试，不调用真实微信支付

## 测试命令

```bash
npm test -w @seafood/api
npx prisma validate --schema prisma/schema.prisma
npm run build:weapp -w @seafood/storefront-miniapp
npx tsc --noEmit -p apps/api/tsconfig.json
```

## 总体结果

```text
API Jest: PASS, 12 suites / 106 tests
Prisma validate: PASS
storefront build: PASS
API tsc: PASS
```

## 金额一致性

| 用例 | 结果 |
| --- | --- |
| 支付金额等于订单金额 | PASS |
| 支付金额小于订单金额 | PASS，拒绝并不创建 PaymentRecord |
| 支付金额大于订单金额 | 覆盖在金额不等统一规则内，拒绝 |
| 支付金额为 0 | PASS，拒绝 |
| 订单金额为 0 | PASS，拒绝微信支付成功处理 |

关键断言：

1. 金额不一致不创建 PaymentRecord。
2. 金额不一致不扣库存。
3. 金额不一致不改变订单状态。
4. 金额不一致只输出脱敏日志。

## 微信 v3 resource 解密

使用测试专用 32 字符 API v3 key 构造 AES-256-GCM 加密 resource。

| 用例 | 结果 |
| --- | --- |
| 正确 key 解密 resource | PASS |
| 错误 key 解密 | PASS，拒绝 |
| `AEAD_AES_256_GCM` 算法 | PASS |
| 交易对象映射 `out_trade_no` | PASS |
| 交易对象映射 `transaction_id` | PASS |
| 交易对象映射 `amount.total` | PASS |

测试 fixture 不包含真实 API v3 key、不包含真实交易号、不包含真实 openid。

## 非 SUCCESS 状态

| 用例 | 结果 |
| --- | --- |
| `trade_state=SUCCESS` | PASS，进入业务处理 |
| `trade_state=NOTPAY` | PASS，拒绝标记已支付 |

非 SUCCESS 状态不会创建 PaymentRecord、不会扣库存、不会用券。

## 重复回调幂等

| 用例 | 结果 |
| --- | --- |
| 首次 SUCCESS 回调 | PASS，返回 `APPLIED` |
| 第二次同 transaction_id 同订单 | PASS，返回 `IGNORED_DUPLICATE` |
| 同 transaction_id 指向不同订单 | PASS，拒绝 |

## 状态边界

| 用例 | 结果 |
| --- | --- |
| 非待支付订单收到支付成功 | PASS，拒绝 |
| 订单号无法解析 | PASS，拒绝 |
| 验签失败 | PASS，拒绝 |
| 平台序列号不匹配 | PASS，拒绝 |
| provider 非 wechat | PASS，拒绝 |

## 原生微信 body 入口

新增 controller 测试确认：

1. 微信原生 body 没有 `provider/callbackPayload` 包装时，controller 缺省 provider 为 `wechat`。
2. controller 从 rawBody 解析 callbackPayload。
3. 签名验证仍使用原始 rawBody。

结果：PASS。

## 日志脱敏检查

允许输出：

```text
orderId 后 6 位
paymentRef 后 8 位
expectedAmountCents
actualAmountCents
```

未输出：

```text
API v3 key
商户私钥
证书
完整 transaction_id
完整 raw callback
完整 decrypted callback
openid
手机号
身份证
银行卡
```

结果：PASS。

## 尚未覆盖

以下必须留到 Phase 2.24C 真机/准正式环境：

1. 真实微信支付创建。
2. 真机 requestPayment 拉起。
3. 真实微信支付成功回调。
4. 微信平台重复通知。
5. partner 模式真实商户字段验证。

