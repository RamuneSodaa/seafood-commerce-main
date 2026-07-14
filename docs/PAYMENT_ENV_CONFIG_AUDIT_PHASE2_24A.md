# Phase 2.24A 支付环境配置审计

阶段：Phase 2.24A_wechat_pay_real_device_special_validation  
生成时间：2026-06-14 16:10 CST  
性质：支付专项环境预检，只读审计，不调用真实支付

## 结论

当前本地环境不能进入微信支付真实/准正式链路验收，状态为 `BLOCKED`。

主要原因：

1. 本地 `.local/env/wechat-miniapp.local` 中只配置了小程序登录与顾客鉴权相关变量。
2. 微信支付商户号、商户证书序列号、商户私钥、支付回调平台公钥/序列号、`notifyUrl` 均未配置。
3. `notifyUrl` 缺失，无法满足微信支付回调必须公网 HTTPS 可访问的要求。
4. 当前小程序 API base 默认仍是本地 `http://127.0.0.1:3000`，适合本地开发，不适合真机支付回调。

本阶段没有输出任何 AppSecret、API v3 key、商户私钥、证书、token、完整 DATABASE_URL。

## 脱敏环境检查

脱敏检查日志见：

```text
.codex_tmp/phase2_24a_logs/payment_env_masked_audit.log
```

关键结果：

| 配置项 | 状态 |
| --- | --- |
| `WECHAT_MINIAPP_APP_ID` | 存在，长度 18，掩码后与项目 AppID 一致 |
| `WECHAT_MINIAPP_APP_SECRET` | 存在，仅记录 length |
| `CUSTOMER_AUTH_ARTIFACT_SECRET` | 存在，仅记录 length |
| `DATABASE_URL` | 存在，指向本地 `127.0.0.1:5433/seafood_phase1`，未输出密码 |
| `WECHAT_PAY_MODE` | 缺失，代码会默认 direct 模式 |
| `WECHAT_PAY_MERCHANT_ID` | 缺失 |
| `WECHAT_PAY_MERCHANT_SERIAL` | 缺失 |
| `WECHAT_PAY_MERCHANT_PRIVATE_KEY_PEM` | 缺失 |
| `WECHAT_PAY_NOTIFY_URL` | 缺失 |
| `WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM` | 缺失 |
| `WECHAT_PAY_PLATFORM_SERIAL` | 缺失 |
| partner 模式相关商户配置 | 均缺失 |

## AppID 一致性

只读检查结果：

```text
project.config.json: wx0ad267108804ad22
apps/storefront-miniapp/project.config.json: wx0ad267108804ad22
apps/storefront-miniapp/dist/project.config.json: wx0ad267108804ad22
后端 WECHAT_MINIAPP_APP_ID: wx0a...ad22 length=18
```

AppID 方向一致，支付阻塞点不在 AppID 配置。

## notifyUrl 检查

当前 `WECHAT_PAY_NOTIFY_URL` 缺失。

正式/准正式支付验收前必须提供：

```text
https://<public-api-domain>/orders/miniapp-payment-callback
```

要求：

1. 必须公网 HTTPS。
2. 必须能被微信支付服务器访问。
3. 必须指向当前后端回调路由。
4. 不得使用 `localhost`、`127.0.0.1` 或本机局域网地址。
5. 如果使用 tunnel，只能作为临时准验收环境，并需确认微信支付后台允许该回调地址。

## 小程序 request 合法域名

当前前端默认 API base：

```text
http://127.0.0.1:3000
```

这适合本地开发和微信开发者工具“忽略合法域名”场景，不适合真机体验版/正式版。

真机支付验收前必须确认：

1. 小程序 `request` 合法域名包含准正式或正式 API 域名。
2. 前端构建时 `TARO_APP_API_BASE_URL` 指向该 HTTPS API 域名。
3. 支付回调域名与 API 服务部署一致或正确反向代理到当前 API。

## 历史 NO_AUTH / 商户限制风险

代码中已对 `NO_AUTH`、商户收款限制、暂无支付等提示做了顾客端友好文案映射：

```text
商户支付功能正在审核中，当前暂不可支付，请稍后重试或联系商家。
```

但本阶段未调用真实微信支付，不能确认当前商户是否仍存在 `NO_AUTH` 或业务权限限制。

## Gate 结论

本阶段不应继续真实支付调用，除非先完成：

1. 配置微信支付商户号、证书序列号、商户私钥。
2. 配置公网 HTTPS `WECHAT_PAY_NOTIFY_URL`。
3. 配置微信支付平台公钥与平台序列号。
4. 确认小程序体验版/开发版 API base 指向 HTTPS 测试 API。
5. 修复支付回调金额一致性校验和微信 v3 原生回调 payload 映射风险。

