# 上线前待办清单

阶段：Phase 2.24C  
性质：上线前收口 backlog

## 已通过

1. 顾客端本地候选版冻结。
2. release candidate baseline。
3. clean migration 草案与隔离 workspace。
4. production seed 拆分：
   - stores
   - products
   - inventory
   - marketing
   - admin bootstrap
5. production inventory seed 补齐。
6. 临时空库 clean migration + production seed apply 演练。
7. 新人券 autoGrant 修复与临时空库复跑。
8. 新用户自动发券、重复不发、checkout 可见券、下单锁券、取消释放券验证通过。
9. Phase 2.24A 支付专项环境与代码路径审计已完成。
10. Phase 2.24B 支付回调金额强校验与微信 v3 resource 解密映射已完成，本地 replay/harness PASS。
11. Phase 2.24C 微信支付环境预检已完成，真实支付因商户配置和公网 HTTPS notifyUrl 缺失被正确阻断。

## Phase 2.24C 支付专项结论

当前不能标记为真实微信支付通过，状态为 `BLOCKED`。

原因：

1. 当前本地环境缺少微信支付商户号、商户证书序列号、商户私钥、`notifyUrl`、微信支付平台公钥与平台序列号。
2. 当前 `notifyUrl` 缺失，未满足公网 HTTPS 回调要求。
3. 当前小程序 API base 仍是本地开发地址，不适合真机体验版/正式支付。
4. 支付成功处理缺少 `paidAmountCents === order.totalAmountCents` 强校验的问题已在 Phase 2.24B 修复。
5. 微信支付 v3 原生回调 `resource` 解密与业务字段映射已在 Phase 2.24B 补齐。
6. rawBody 代码路径已确认：Nest 启动保留 rawBody，回调验签使用原始 rawBody。
7. 真实商户支付创建、真机 requestPayment、真实回调和微信平台重复通知仍未验收。

## 当前推荐推进顺序

1. Phase 2.24D：补齐微信支付真实/准正式环境变量与公网 HTTPS notifyUrl 后，再执行低额真机专项验收。
2. Phase 2.25A：后台运营最小上线验收。
3. Phase 2.26A：小程序体验版/提审材料整理。
4. Phase 2.27A：正式上线前最终 checklist。

## 上线前必须完成

1. 明确上线数据库策略：
   - 空库新上线：使用 clean baseline。
   - 已有库：走 current-db-to-schema diff。
2. 准生产或临时空库再次演练 migration + seed。
3. 正式支付链路真机验收：
   - 商户号、商户私钥、API v3 key、平台公钥、平台序列号配置完整
   - notifyUrl 为公网 HTTPS 且路径指向 `/orders/miniapp-payment-callback`
   - 支付金额回调必须等于订单应付金额
   - 微信 v3 原生回调 resource 解密和字段映射
   - 支付创建
   - 前端调起微信支付
   - 用户取消支付
   - 支付成功
   - 支付成功回调验签
   - 重复回调幂等
   - 支付成功用券
   - 支付失败/取消支付保持待支付
4. 生产部署准备：
   - API HTTPS 域名
   - 小程序 request 合法域名
   - 微信支付回调 HTTPS 域名
   - 环境变量与密钥管理
5. 小程序发布配置：
   - AppID
   - 服务类目
   - 隐私协议
   - 体验版/审核材料
6. 完整顾客端测试矩阵真机回归。
7. 建立 git 版本基线或完整代码备份。

## 上线前建议完成

1. 后台运营基础验收：
   - 商品上下架
   - 门店维护
   - 库存调整
   - 订单处理
2. 后台操作日志复核。
3. 超时待支付订单从 lazy expiration 升级为定时任务/队列。
4. 正式商品图片与商品资料接入。
5. 日志、监控、告警、错误追踪。
6. 非技术同事正式后台使用说明。

## 仍需运营确认

1. 正式门店。
2. 正式商品。
3. 正式 SKU。
4. 正式价格。
5. 正式库存。
6. 正式优惠券金额、门槛、有效期。
7. 正式会员价。
8. 正式管理员账号。

## 二期功能

1. 优惠券模板管理。
2. 会员价管理。
3. 邀请奖励活动配置。
4. 发券记录与用户优惠券查询。
5. 数据报表：
   - 订单金额
   - 商品销量
   - 门店库存
   - 优惠券使用率
6. 客服入口/客服二维码。
7. 品牌故事页。
8. 商品详情图、食用建议、适合人群、保存方式。

## 暂不建议做

1. 现金返利。
2. 提现。
3. 多级分销。
4. 复杂积分商城。
5. AI 客服。
6. 大规模 UI 重做。
7. 将优惠金额写死在前端。
