# Phase 2.24D 微信支付环境 gate 结果

生成时间：2026-06-14 17:00 CST  
阶段：Phase 2.24D_wechat_pay_local_env_wiring_and_https_notify_preflight

## Gate 状态

```text
BLOCKED_ENV_MISSING
```

## 为什么不是 READY

当前预检脚本在 source 本地 env 后执行，支付配置仍缺少以下必要项：

```text
WECHAT_PAY_MERCHANT_ID
WECHAT_PAY_MERCHANT_SERIAL
WECHAT_PAY_MERCHANT_PRIVATE_KEY_PEM
WECHAT_PAY_NOTIFY_URL
WECHAT_PAY_API_V3_KEY
WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM
WECHAT_PAY_PLATFORM_SERIAL
notifyUrl reachability
```

因此不能进入低额真机支付测试。

## 已确认项

1. `WECHAT_MINIAPP_APP_ID` 存在，并与项目 AppID 配置一致。
2. `WECHAT_MINIAPP_APP_SECRET` 存在。
3. 小程序 source/dist/root 三处 AppID 配置一致。
4. rawBody 代码路径已在 Phase 2.24C 确认。
5. 本阶段没有调用真实微信支付接口。

## 三种 gate 状态说明

### READY_FOR_LOW_AMOUNT_REAL_DEVICE_TEST

只有同时满足以下条件才可以进入下一阶段：

1. 所有必要 env present。
2. 私钥、公钥 PEM parseable。
3. API v3 key 为 32 bytes。
4. notifyUrl 为公网 HTTPS。
5. notifyUrl 路径正确。
6. notifyUrl 可达。
7. rawBody 已确认。
8. 小程序 AppID 一致。

### BLOCKED_ENV_MISSING

任一必要 env 缺失或格式不正确时使用该状态。

当前即为该状态。

### BLOCKED_NOTIFY_URL

env 基本齐全，但 notifyUrl 不是 HTTPS、不是公网、路径不对或不可达时使用该状态。

## 当前结论

当前仍不能发起真实微信支付，不能创建真实 prepay，不能进行真机支付验收。

下一步应先由持有商户资料的人在本机私密 env 中补齐微信支付配置，再重新运行：

```bash
source .local/env/wechat-miniapp.local
node scripts/check-wechat-pay-env-local.js
```
