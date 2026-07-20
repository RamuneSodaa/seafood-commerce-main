# 微信支付当前状态

更新时间：20260720_213734

## 已确认

- 商户收款/付款限制已经解除
- 当前商户使用微信支付公钥模式
- 微信支付公钥已下载并移出公开 Git 仓库目录
- 微信支付公钥 ID 已确认并保存在本机安全目录
- 商户 API 证书与商户 RSA 私钥已准备且匹配
- APIv3 密钥已配置
- Git 历史中未出现支付私钥或 P12 文件
- GitHub CI 已覆盖 npm ci、Prisma、API tests、Admin、Storefront、Miniapp build

## P0.4-P0.7 安全改造

- 后端支持 `WECHAT_PAY_PUBLIC_KEY_PEM` 或 `WECHAT_PAY_PUBLIC_KEY_PATH`
- 使用 `WECHAT_PAY_PUBLIC_KEY_ID` 校验 `Wechatpay-Serial`
- 微信支付 APIv3 应答在生产环境中强制验签
- 微信支付回调使用原始 body 验签
- 回调 `Wechatpay-Timestamp` 限制在 5 分钟窗口内，降低重放风险
- 回调资源继续使用 APIv3 密钥进行 AES-256-GCM 解密
- 保留旧平台证书环境变量作为迁移期兼容，不作为当前商户正式配置

## P0.8B 顾客身份凭证安全

- `CUSTOMER_AUTH_ARTIFACT_SECRET` 已生成并保存在仓库外安全目录
- 顾客 auth artifact 默认有效期 7 天
- 可通过 `CUSTOMER_AUTH_ARTIFACT_TTL_SECONDS` 调整有效期
- 超过有效期的 artifact 拒绝访问
- 超出 5 分钟时钟偏差的未来 `iat` 拒绝访问
- 非法 TTL 配置 fail-closed

## 仍未完成

- 小程序 AppID 与商户号的最终线上授权/绑定实测
- 稳定公网 HTTPS API 与支付回调地址
- 真实 JSAPI 下单获取 `prepay_id`
- 0.01 元级真实支付闭环
- 真实微信支付异步回调、订单状态、库存、重复通知幂等验证
- 上线前密钥轮换与最终安全审计

## 正式环境变量

请求签名：
- `WECHAT_PAY_MERCHANT_ID`
- `WECHAT_PAY_MERCHANT_SERIAL`
- `WECHAT_PAY_MERCHANT_PRIVATE_KEY_PEM`

微信支付身份验签：
- `WECHAT_PAY_PUBLIC_KEY_PEM` 或 `WECHAT_PAY_PUBLIC_KEY_PATH`
- `WECHAT_PAY_PUBLIC_KEY_ID`

回调解密：
- `WECHAT_PAY_API_V3_KEY`

小程序支付：
- `WECHAT_MINIAPP_APP_ID`
- `WECHAT_PAY_NOTIFY_URL`

不得把私钥、APIv3 密钥或 AppSecret 提交到 GitHub。
