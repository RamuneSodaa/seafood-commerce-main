# Phase 2C Identity Placeholder Ready

本文档用于短收口当前 Phase 2C 已完成的 identity placeholder 层，不展开真实登录实现，只明确当前已经落地的调试入口、优先级和代码边界。

## 1. 当前真实现状

- web storefront 已有：
- `/dev/identity`
- miniapp 已有：
- `/pages/dev-identity/index`
- 两端当前都支持：
- 写入占位身份
- 清空占位身份
- 查看当前 provider 解析出来的 identity
- 查看当前 storage 占位值
- 两端当前都能提示：
- storage 是否被显式 `profile / env` 覆盖

当前意味着：

- identity placeholder 层已经不只是代码抽象
- web / miniapp 两端都已经有实际可用的开发调试入口

## 2. 当前 identity source 优先级

当前两端的 identity source 优先级已经固定为：

1. `profile / env`
2. `storage placeholder`
3. `demo fallback`

也就是说：

- 如果显式配置了 profile 或 customer identity，优先使用显式配置
- 如果没有显式配置，则尝试读取本地存储里的占位身份
- 如果两者都没有，则回退到：
- `CUSTOMER + demo-customer`

## 3. 当前代码边界

当前已收口好的代码边界如下：

- 页面层不感知真实登录
- identity provider 是唯一解析入口
- storage helper 是唯一占位身份读写清理入口

当前推荐理解方式：

- 页面只展示当前解析结果或调用 helper
- 真实身份接入前，不要把账号逻辑散到业务页面
- 未来真实身份优先写入 provider / storage helper 层，而不是直接改页面

## 4. 当前仍未做的内容

当前明确仍未做：

- 微信登录
- `openid / unionid`
- token / session 真接入
- 正式用户中心
- 正式账号体系

这些内容都不在当前 Phase 2C 已完成范围内。

## 5. 下一步最小任务建议

下一步不建议直接做完整登录。

更合理的最小任务是进入“真实身份接入前准备”的最小方案，只先定义：

- 未来真实身份写入 storage 的接入位点
- 未来 provider 如何优先读取真实身份
- 未来哪些占位 helper 可以继续复用，哪些只保留给开发调试

目标是先把真实身份接入位点钉死，再考虑完整登录流程。

## 6. 阶段结论

当前仓库已经完成：

- identity placeholder 的统一优先级
- identity storage helper 的统一入口
- web / miniapp 两端的 dev-only 调试入口

这意味着：

- Phase 2C 当前已经具备“真实身份接入前的占位层就绪”状态
- 下一步应先做真实身份接入位点设计，而不是直接上完整登录实现
