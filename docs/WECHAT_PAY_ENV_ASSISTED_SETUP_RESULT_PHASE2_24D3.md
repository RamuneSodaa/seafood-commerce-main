# Phase 2.24D3 微信支付本地 env 辅助配置结果

生成时间：2026-06-14 17:34 CST  
阶段：Phase 2.24D3_wechat_pay_local_env_assisted_setup  
性质：本地辅助脚本与脱敏预检，不调用真实微信支付。

## 结论

本阶段已新增本地辅助脚本：

```text
scripts/setup-wechat-pay-env-local.sh
```

脚本用于在本机交互式配置微信支付 env：隐藏输入 APIv3 密钥、校验公网 HTTPS notifyUrl、检查商户私钥和平台公钥、备份并重写 `.local/env/wechat-miniapp.local`。

出于安全原因，Codex 没有在聊天或工具日志中代填 APIv3 密钥，也没有输出 AppSecret、私钥、公钥或真实 env 原文。当前实际预检仍基于现有本地 env，gate 结果为：

```text
BLOCKED_ENV_MISSING
```

## 本阶段是否改动业务

| 检查项 | 结果 |
| --- | --- |
| 是否修改业务代码 | 否 |
| 是否修改 schema | 否 |
| 是否执行 migration | 否 |
| 是否执行 seed | 否 |
| 是否调用真实微信支付 | 否 |
| 是否创建 prepay | 否 |
| 是否新增本地辅助脚本 | 是 |

## 当前脱敏预检结果

| 项目 | 结果 |
| --- | --- |
| 小程序 AppID | PASS，已脱敏，且与项目配置一致 |
| 小程序 AppSecret | PASS，仅确认存在 |
| 商户号 | PASS，已脱敏 |
| 商户 API 证书序列号 | PASS，已脱敏 |
| 商户私钥文件 | exists=true，parseable=true |
| APIv3 key | FAIL，当前 bytes=36，必须为 32 |
| 平台公钥文件 | exists=false，parseable=false |
| 平台公钥 ID / 序列号 | PASS，已脱敏 |
| notifyUrl | FAIL，当前为 invalid-url |
| notifyUrl HTTPS | FAIL |
| notifyUrl 公网域名 | FAIL |
| notifyUrl path | FAIL |
| notifyUrl reachability | FAIL，未尝试访问 |
| gate 状态 | BLOCKED_ENV_MISSING |

## 当前必须补齐

1. 重新执行辅助脚本并隐藏输入真实 32 bytes APIv3 key。
2. 填写纯 URL 格式 notifyUrl，例如：

```text
https://xxxxx.trycloudflare.com/orders/miniapp-payment-callback
```

不要使用 Markdown 链接格式。

3. 创建并粘贴微信支付平台公钥 PEM：

```text
/Users/s11184/Desktop/seafood-commerce-main/wechatpay_platform_public_key.pem
```

必须是微信支付平台公钥，不是商户 `apiclient_cert.pem`，也不是商户 `apiclient_key.pem`。

4. 当前本机未检测到 `cloudflared`。如果要使用 Cloudflare Tunnel，需要先在本机安装或改用已有公网 HTTPS API 域名。

## 本机执行方式

在本机终端执行：

```bash
cd /Users/s11184/Desktop/seafood-commerce-main
bash scripts/setup-wechat-pay-env-local.sh
```

执行时需要手动输入：

1. APIv3 密钥，隐藏输入。
2. 公网 HTTPS notifyUrl。
3. 如果平台公钥文件不存在，在 nano 中粘贴平台公钥 PEM。

脚本完成后会自动执行：

```bash
node scripts/check-wechat-pay-env-local.js
```

只有输出：

```text
gateStatus=READY_FOR_LOW_AMOUNT_REAL_DEVICE_TEST
```

才允许进入低额真机支付验收。

## 下一阶段建议

待本机交互脚本完成并且 gate 变为 READY 后，再进入低额真机支付专项验收。若 gate 只剩 notifyUrl reachability 失败，则优先确认 API 是否启动、tunnel 是否打开、微信回调域名是否能访问本机 API。
