# Seafood Commerce

> **项目所有者及维护者：RamuneSodaa**
>
> 面向海味干货、滋补汤料、天然海鱼和海鲜门店的微信下单及经营管理系统。
>
> 本仓库用于项目展示、版本管理和开发协作。目前没有授予开源许可证；未经书面许可，不得复制、商用或重新发布。

## 项目组成

- 微信小程序商城
- 顾客网页商城
- 管理后台
- NestJS 后端 API
- PostgreSQL 与 Prisma 数据层
- 商品、SKU、分类、门店和库存
- 购物车、地址、自提和配送订单
- 鲜鱼预订、优惠券、会员和推荐奖励
- 管理员认证和审计日志
- 微信登录与微信支付相关代码

## 当前状态

项目已建立本地 Git 和公开 GitHub 基线，但仍处于开发及上线准备阶段。

当前重点：

- 微信支付产品权限仍在审批中
- 正式微信支付尚未完成真实付款测试
- Prisma migration 历史需要统一整理
- package-lock 需要进行干净安装验证
- 部分旧顾客接口需要认证安全整改
- 生产构建和部署门禁仍需补充

详细资料见：

- docs/PROJECT_STATUS.md
- docs/PRELAUNCH_BACKLOG.md
- docs/RELEASE_READINESS_AUDIT.md
- docs/WECHAT_PAY_STATUS.md

## 技术栈

- 后端：NestJS、TypeScript
- 管理后台与网页商城：Next.js、React、TypeScript
- 微信小程序：Taro、React、TypeScript
- 数据库：PostgreSQL、Prisma
- 测试：Jest
- 版本管理：Git、GitHub

## 项目目录

- apps/api/：后端 API
- apps/admin-web/：管理后台
- apps/storefront-web/：顾客网页商城
- apps/storefront-miniapp/：微信小程序
- packages/shared-types/：共享类型
- prisma/：数据库模型与迁移
- scripts/：本地启动和维护脚本
- docs/：项目、开发和发布文档

## 本地使用

1. 安装依赖：npm install
2. 复制数据库示例：cp .env.example .env
3. 只在本机编辑 .env
4. 生成 Prisma Client：npx prisma generate
5. 建立本地管理员凭据：bash scripts/ensure-admin-local-env.sh
6. 运行 API 测试：npm test
7. 启动本地后台：npm run dev:admin-local

真实 .env、.local、微信密钥、支付证书、数据库数据和顾客隐私不得上传到 GitHub。

## 版权

Copyright © 2026 RamuneSodaa. All rights reserved.

本仓库目前没有提供 MIT、Apache、GPL 或其他开源许可证。
