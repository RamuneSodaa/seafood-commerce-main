# Phase 2.24D 微信支付本地 env 装配说明

生成时间：2026-06-14 17:00 CST  
阶段：Phase 2.24D_wechat_pay_local_env_wiring_and_https_notify_preflight  
性质：本地 env 装配与安全预检，不调用真实微信支付。

## 结论

本阶段新增了本地微信支付 env 预检脚本和本地 env 示例文件。当前仍不进入真实微信支付，因为支付环境变量和公网 HTTPS notifyUrl 尚未完整通过 gate。

本阶段没有修改支付核心逻辑，没有修改订单、优惠券、库存、会员、商品、凑单或再来一单逻辑。

## 本地 env 文件

本地私密 env 文件固定使用：

```text
.local/env/wechat-miniapp.local
```

该文件必须只保存在本机，不要提交、不要打包、不要粘贴到聊天或文档。

本阶段更新 `.gitignore`，继续忽略真实私密文件：

```text
.local/env/wechat-miniapp.local
```

允许保留无密钥说明文件：

```text
.local/env/README.md
.local/env/wechat-miniapp.local.example
```

## 本地安全加载方式

在本机打开一个新终端：

```bash
cd /Users/s11184/Desktop/seafood-commerce-main
source .local/env/wechat-miniapp.local
node scripts/check-wechat-pay-env-local.js
```

预检通过后，再启动 API：

```bash
npm run start -w @seafood/api
```

注意：如果重新打开终端，需要重新 `source .local/env/wechat-miniapp.local`。

## 微信支付变量名

代码读取的 direct 模式变量为：

```text
WECHAT_MINIAPP_APP_ID
WECHAT_MINIAPP_APP_SECRET
WECHAT_PAY_MODE
WECHAT_PAY_MERCHANT_ID
WECHAT_PAY_MERCHANT_SERIAL
WECHAT_PAY_MERCHANT_PRIVATE_KEY_PEM
WECHAT_PAY_NOTIFY_URL
WECHAT_PAY_API_V3_KEY
WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM
WECHAT_PAY_PLATFORM_SERIAL
```

partner 模式额外需要：

```text
WECHAT_PAY_SP_MERCHANT_ID
WECHAT_PAY_SP_MERCHANT_SERIAL
WECHAT_PAY_SP_MERCHANT_PRIVATE_KEY_PEM
WECHAT_PAY_SUB_MERCHANT_ID
```

当前默认模式为 direct。

## 私钥和公钥建议

不要把私钥或公钥原文写进文档。建议在本地 env 中从本机安全路径读取：

```bash
export WECHAT_PAY_MERCHANT_PRIVATE_KEY_PEM="$(cat "$HOME/.seafood-secrets/seafood-commerce/wechat-pay/apiclient_key.pem")"
export WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM="$(cat "$HOME/.seafood-secrets/seafood-commerce/wechat-pay/wechatpay_platform_public_key.pem")"
```

文件路径只放在本机私密 env 中，不放入 review pack。

## API v3 key

`WECHAT_PAY_API_V3_KEY` 必须为 32 bytes。预检脚本只输出：

```text
present bytes=32 lengthOk=true
```

不会输出 key 原文。

## notifyUrl

`WECHAT_PAY_NOTIFY_URL` 必须是公网 HTTPS，并指向：

```text
/orders/miniapp-payment-callback
```

可以使用：

1. 正式 HTTPS API 域名。
2. 准正式 HTTPS API 域名。
3. Cloudflare Tunnel / ngrok 这类临时 HTTPS 公网 tunnel。

如果使用 tunnel，重启 tunnel 后域名可能变化，必须同步更新 `WECHAT_PAY_NOTIFY_URL`，并重新运行预检脚本。

## 微信后台配置

即使本地 env 通过，也还需要在微信相关后台确认：

1. 小程序合法 request 域名。
2. 微信支付回调地址。
3. AppID 与商户号绑定关系。
4. 商户证书/平台公钥模式与代码配置一致。

## 禁止事项

1. 不要把真实 AppSecret、API v3 key、商户私钥、公钥全文写入 docs。
2. 不要把 `.local/env/wechat-miniapp.local` 放进 review pack。
3. 不要把完整 notifyUrl query secret 写入日志。
4. 不要在 env gate 未通过时调用真实微信支付。
