# Phase 2.24C 微信支付环境预检

生成时间：2026-06-14 16:41 CST  
阶段：Phase 2.24C_wechat_pay_env_preflight_and_real_device_gate  
性质：支付环境 gate，只做脱敏预检，不调用真实微信支付。

## 结论

当前微信支付真实/准正式环境配置不完整，状态为 `BLOCKED`。

本阶段没有修改业务代码，没有修改 `prisma/schema.prisma`，没有执行 migration，也没有执行 seed。由于缺少商户号、商户私钥、API v3 key、平台公钥和公网 HTTPS 回调地址，本阶段不得继续发起真实微信支付。

## 脱敏环境检查

环境文件 `.local/env/wechat-miniapp.local` 存在，但内容未读取到文档或 review pack 中。

| 配置项 | 预检结果 | 说明 |
| --- | --- | --- |
| `WECHAT_MINIAPP_APP_ID` | `wx0a...ad22`，长度 18 | 与项目配置中的小程序 AppID 一致 |
| `WECHAT_MINIAPP_APP_SECRET` | present，长度 32 | 仅确认存在，不输出原文 |
| `WECHAT_PAY_MODE` | missing | 代码默认 direct 模式 |
| `WECHAT_PAY_MERCHANT_ID` | missing | 无法创建真实微信支付 |
| `WECHAT_PAY_MERCHANT_SERIAL` | missing | 无法生成微信支付签名 |
| `WECHAT_PAY_MERCHANT_PRIVATE_KEY_PEM` | missing | 未做真实私钥解析 |
| `WECHAT_PAY_NOTIFY_URL` | missing | 无公网 HTTPS 回调地址 |
| `WECHAT_PAY_API_V3_KEY` | missing | 无法解密微信支付 v3 resource |
| `WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM` | missing | 无法验签真实微信支付回调 |
| `WECHAT_PAY_PLATFORM_SERIAL` | missing | 无法匹配真实回调平台序列号 |
| `WECHAT_PAY_SP_MERCHANT_ID` | missing | partner 模式未配置 |
| `WECHAT_PAY_SUB_MERCHANT_ID` | missing | partner 模式未配置 |

## AppID 一致性

检查到以下项目配置均为同一个公开 AppID：

```text
project.config.json
apps/storefront-miniapp/project.config.json
apps/storefront-miniapp/dist/project.config.json
```

AppID 脱敏展示：`wx0a...ad22`。

## notifyUrl 检查

当前 `WECHAT_PAY_NOTIFY_URL` 缺失，因此以下检查无法通过：

1. 是否为 HTTPS。
2. 是否为公网可访问域名。
3. 是否不是 `127.0.0.1`、`localhost` 或内网 IP。
4. 路径是否指向当前后端微信支付回调路由：

```text
/orders/miniapp-payment-callback
```

因此真实微信支付回调无法到达本地 API，本阶段必须阻断真机支付结论。

## 密钥和证书检查

1. 商户私钥缺失，未做 PEM 解析。
2. 平台公钥缺失，未做 PEM 解析。
3. API v3 key 缺失，无法确认 32 bytes。
4. 平台序列号缺失，无法确认回调头 `wechatpay-serial` 是否匹配。

## Gate 结果

| 检查项 | 结果 |
| --- | --- |
| 支付环境是否完整 | BLOCKED |
| 是否允许创建真实预支付订单 | 否 |
| 是否允许真机调起微信支付 | 否 |
| 是否允许声明真实支付验收通过 | 否 |

## 下一步

进入真实/准正式支付测试前，必须先补齐：

1. 正式或准正式商户号。
2. 商户证书序列号。
3. 商户私钥 PEM。
4. API v3 key。
5. 微信支付平台公钥或平台证书公钥。
6. 平台序列号。
7. 公网 HTTPS `notifyUrl`。
8. 微信支付后台回调地址配置。

以上配置只能通过安全环境变量或密钥管理注入，不能写入仓库、文档或 review pack。
