# Phase 2B Identity Payment Boundary Ready

本文档用于短收口当前 Phase 2B 已完成的身份与支付边界代码，不展开真实登录或真实支付实现，只明确当前已钉死的替换点。

## 1. 当前真实现状

- web storefront 的 identity source 已可配置，默认仍是：
- `x-role: CUSTOMER`
- `x-user-id: demo-customer`
- miniapp 的 identity source 已可配置，默认仍是：
- `x-role: CUSTOMER`
- `x-user-id: demo-customer`
- web storefront 的 payment mode 已可配置，默认仍是 `mock`
- miniapp 的 payment mode 已可配置，默认仍是 `mock`

当前意味着：

- 页面不再直接写死顾客身份
- 页面也不再直接决定支付模式
- 当前系统仍然运行在 demo customer + mock payment 边界内

## 2. 当前代码边界

当前已收口好的代码边界如下：

- identity provider / config 是当前顾客身份唯一来源
- 页面层不再直接写死 `demo-customer`
- 页面层不再直接碰 `markPaid`
- 页面层不再直接承载 `mock / wechat-placeholder` 细节
- payment transition 是当前支付状态推进入口
- web / miniapp 两端都返回统一结果语义：
- `mode`
- `success`
- `message`

当前推荐理解方式：

- 页面只调用 identity / payment transition
- 未来真实身份或真实支付接入时，优先改 config / provider / transition 层
- 不要先改页面业务代码

## 3. 当前仍未做的内容

当前明确仍未做：

- 真实微信登录
- `openid / unionid`
- token / session
- 真实微信支付
- 支付回调处理
- 真实顾客身份接入

这些内容都不在当前 Phase 2B 已完成范围内。

## 4. 下一步最小任务建议

下一步不建议直接进入真实登录或真实支付实现。

更合理的最小任务是先进入“环境与接入准备层”，只做最小配置收口，例如：

- 统一整理 `baseURL`
- 统一整理 identity source
- 统一整理 payment mode
- 明确 `dev / test / demo` 三种 profile 的最小配置切换方式

目标是先把“环境入口”收干净，再开始真实身份和真实支付接入。

## 5. 阶段结论

当前仓库已经完成：

- identity source 的单一替换点
- payment mode 的单一替换点
- payment transition 的统一结果语义

这意味着：

- Phase 2B 当前已经具备“接入前边界就绪”状态
- 下一步应先补环境准备层，而不是直接跳到登录 / 支付实现
