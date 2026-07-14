# Seafood Commerce Project Status

更新时间：20260714_153549

## 已完成

- 已建立本地 Git 仓库
- 已连接公开 GitHub 仓库
- 默认分支为 main
- 已建立 public-handover-v0 基线标签
- 公开仓库秘密文件扫描已通过
- 商户证书与私钥已验证匹配
- 微信小程序 AppID 和 AppSecret 已完成本机配置
- 微信支付 APIv3 密钥已完成本机配置
- 商品、门店、库存、购物车、地址和订单代码已经存在
- 优惠券、会员、推荐奖励和鲜鱼预订代码已经存在
- 管理员认证、审计日志、微信登录和微信支付相关代码已经存在

## 当前阻塞项

- 微信支付产品权限仍在审批中
- Prisma schema 与 migration 历史需要专项核对
- 旧顾客身份请求头接口需要安全整改
- 顾客登录凭证需要增加过期时间
- 需要从 GitHub 干净克隆并验证全部安装、测试和编译流程

## 下一阶段

Clean Clone Build Verification。

从 GitHub 克隆全新副本，验证：

- npm 干净安装
- package-lock 一致性
- Prisma Client 生成
- API 测试
- 管理后台编译
- 顾客网页商城编译
- 微信小程序编译

## Clean Clone Verification v0.3

验证时间：20260714_162405

已在全新临时副本中通过：

- npm ci
- Prisma schema validate
- Prisma Client generate
- API Jest测试
- 管理后台生产编译
- 顾客网页商城生产编译
- 微信小程序编译

本轮修复：

- Next App Router固定使用React 19.0.0和React 19类型
- Taro小程序独立使用React 18.3.1和React 18类型
- Taro依赖固定为4.1.11，避免4.1与4.2混装
- 更新过期API测试样本
