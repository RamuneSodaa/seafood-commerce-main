# Phase 2.24D notifyUrl 公网 HTTPS 预检

生成时间：2026-06-14 17:00 CST  
阶段：Phase 2.24D_wechat_pay_local_env_wiring_and_https_notify_preflight  
性质：notifyUrl 可达性 gate，不发送支付成功回调。

## 结论

当前本地环境中 `WECHAT_PAY_NOTIFY_URL` 仍未配置，因此 notifyUrl 预检状态为 `BLOCKED_NOTIFY_URL` 的前置阻断项。

由于支付基础 env 也不完整，本阶段最终 gate 为 `BLOCKED_ENV_MISSING`，未进行真实微信支付调用。

## notifyUrl 要求

`WECHAT_PAY_NOTIFY_URL` 必须满足：

1. 使用 HTTPS。
2. 使用公网可访问域名。
3. 不是 `localhost`、`127.0.0.1`、内网 IP 或 `.local` 域名。
4. 路径为：

```text
/orders/miniapp-payment-callback
```

5. 能从公网访问到 API 网络层。

## 安全可达性检查方式

本阶段新增脚本：

```text
scripts/check-wechat-pay-env-local.js
```

当 `WECHAT_PAY_NOTIFY_URL` 满足 HTTPS、公网域名和路径条件时，脚本会使用安全的 `GET` 请求检查该 URL 是否能返回 HTTP 响应。

该请求不包含支付成功含义，不携带微信支付签名头，不会触发订单已支付处理。

## 不允许的检查方式

1. 不允许伪造支付成功回调作为通过结论。
2. 不允许绕过微信支付验签。
3. 不允许写入完整 raw callback。
4. 不允许写入完整 decrypted callback。
5. 不允许将假回调成功当成真实微信支付成功。

## 当前检查结果

当前预检脚本输出：

```text
WECHAT_PAY_NOTIFY_URL: FAIL (missing)
notifyUrl HTTPS: FAIL (missing)
notifyUrl public host: FAIL (missing)
notifyUrl callback path: FAIL (missing)
notifyUrl reachability: FAIL (attempted=false status=n/a reason=not-attempted)
```

## 后续通过条件

只有以下条件同时满足，才允许进入低额真机支付测试：

1. 支付 env 全部存在且格式正确。
2. 商户私钥 PEM 可解析。
3. 平台公钥 PEM 可解析。
4. API v3 key 为 32 bytes。
5. notifyUrl 是公网 HTTPS。
6. notifyUrl 路径正确。
7. notifyUrl 可访问到 API 网络层。
8. rawBody 代码路径仍确认可用。
9. 小程序 AppID 与项目配置一致。

如果 notifyUrl 缺失、不是 HTTPS、不是公网、路径不对或不可达，必须保持 `BLOCKED_NOTIFY_URL`，不得调用真实微信支付。
