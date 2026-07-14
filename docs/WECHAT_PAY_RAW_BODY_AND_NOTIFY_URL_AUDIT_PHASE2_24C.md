# Phase 2.24C rawBody 与 notifyUrl 审计

生成时间：2026-06-14 16:41 CST  
阶段：Phase 2.24C_wechat_pay_env_preflight_and_real_device_gate  
性质：只读代码审计与回调网关检查。

## 结论

代码层面已确认 Nest 启动时保留 rawBody，微信支付回调路由会读取 `req.rawBody`，验签消息使用原始 rawBody。

但当前 `WECHAT_PAY_NOTIFY_URL` 缺失，无法证明微信支付平台能通过公网 HTTPS 访问本地 API。因此真实回调仍为 `BLOCKED`，不能进入真机支付成功结论。

## rawBody 审计

后端启动入口：

```text
apps/api/src/main.ts
```

已启用：

```text
NestFactory.create(AppModule, { rawBody: true })
```

回调路由：

```text
POST /orders/miniapp-payment-callback
```

实现位置：

```text
apps/api/src/modules/orders/orders.controller.ts
```

回调 controller 行为：

1. 读取 `req.rawBody?.toString('utf8')`。
2. 如果请求体没有项目早期包装式 `callbackPayload`，则从原始 rawBody 解析微信原生 JSON。
3. 将 rawBody 与微信支付签名头一起传入订单 workflow。
4. 正常应用或重复幂等时返回：

```json
{ "acknowledged": true }
```

## 验签使用的 body

实现位置：

```text
apps/api/src/modules/orders/miniapp-payment-callback-verification.service.ts
```

验签消息使用：

```text
timestamp + "\n" + nonce + "\n" + rawBody + "\n"
```

因此不是使用 JSON stringify 后的 body，满足微信支付 v3 回调验签对原始请求体的要求。

## resource 解密路径

当前代码要求：

1. 验签通过。
2. `resource.algorithm` 为 `AEAD_AES_256_GCM`。
3. `WECHAT_PAY_API_V3_KEY` 存在且为 32 bytes。
4. 使用 AES-256-GCM 解密 resource。
5. 仅 `trade_state=SUCCESS` 进入支付成功业务。
6. `amount.total` 必须等于订单 `totalAmountCents` 才能标记支付成功。

本阶段没有真实回调，未记录完整 raw callback 或完整解密明文。

## notifyUrl 审计

当前 `WECHAT_PAY_NOTIFY_URL` 缺失。

因此无法完成：

1. HTTPS 检查。
2. 公网域名检查。
3. 微信支付平台访问检查。
4. 外部访问到 `POST /orders/miniapp-payment-callback` 的可达性检查。
5. 微信真实回调重试行为观察。

## 回调异常与微信重试

代码层面：

1. 正常应用支付成功返回 200。
2. 重复回调幂等返回 200。
3. 验签失败、解密失败、金额不一致等异常会抛出 HTTP 错误。

真实微信支付平台是否按预期重试，仍需要在公网 HTTPS notifyUrl 配好后进行真机/准正式验证。

## Gate 结果

| 检查项 | 结果 |
| --- | --- |
| Nest rawBody | 代码层面确认可用 |
| controller 是否读取 rawBody | 代码层面确认可用 |
| 验签是否使用原始 rawBody | 代码层面确认可用 |
| native 微信 v3 body 支持 | Phase 2.24B 已补齐 |
| notifyUrl HTTPS 公网可达 | BLOCKED，当前缺失 |
| 真实回调验签/解密 | NOT_RUN，等待真实环境 |

## 下一步

补齐公网 HTTPS `WECHAT_PAY_NOTIFY_URL` 后，需要执行：

1. 外部网络访问回调域名健康检查。
2. 低额真实支付创建。
3. 真机调起支付。
4. 用户取消支付测试。
5. 支付成功真实回调验签与 resource 解密。
6. 重复回调幂等观察。
