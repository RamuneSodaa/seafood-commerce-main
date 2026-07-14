# 小程序路由与 API 地图

阶段：Phase 2.22A  
用途：上线前接口复测、压测和发布检查。

## 小程序正式页面路由

| 页面 | 路由 | 作用 |
| --- | --- | --- |
| 首页/商品列表 | `pages/products/index` | 品牌首页、分类、搜索、SKU 弹窗、加入购物车、立即购买 |
| 商品页 tab | `pages/catalog/index` | 商品入口，承接 tabBar 商品 |
| 我的/登录 | `pages/customer-login/index` | 微信登录、我的权益、优惠券/会员/邀请入口 |
| 商品详情 | `pages/product-detail/index` | 商品详情、规格、加入购物车、立即购买 |
| 购物车 | `pages/cart/index` | 购物车商品、数量、移除、去结算 |
| 确认订单 | `pages/checkout/index` | 地址/门店、优惠券、兑换码、凑单、提交订单 |
| 订单列表 | `pages/orders/index` | 订单状态、支付/取消/再来一单 |
| 订单详情 | `pages/order-detail/index` | 订单状态、明细、支付、取消、再来一单 |
| 优惠券中心 | `pages/coupons/index` | 可用/锁定/已用/过期优惠券 |
| 会员中心 | `pages/member/index` | 会员等级、权益、邀请入口 |

`src/pages/dev-*` 文件仍存在于源码目录，但不在 `app.config.ts` 的正式 pages 配置中。

## 顾客端主要 API

| API | 用途 | 风险类型 | 上线前复测 |
| --- | --- | --- | --- |
| `GET /products` | 商品列表、分类、搜索 | 商品展示、库存入口 | 必须 |
| `GET /products/:id` | 商品详情 | 商品展示、SKU | 必须 |
| `GET /stores` | 广州门店列表 | 门店/履约 | 必须 |
| `GET /cart` | 购物车读取 | 金额、库存、用户身份 | 必须 |
| `POST /cart/items` | 加入购物车 | 库存、用户身份 | 必须 |
| `PATCH /cart/items/:id` | 修改数量 | 库存、金额 | 必须 |
| `DELETE /cart/items/:id` | 移除购物车商品 | 用户身份 | 必须 |
| `POST /cart/clear-items` | 结算后清理购物车 | 订单/购物车一致性 | 必须 |
| `POST /orders/quote-preview/authenticated` | checkout 金额预览 | 金额、会员价、优惠券 | 必须重点压测 |
| `POST /orders/authenticated` | 创建订单 | 金额、库存、锁券、订单 | 必须重点压测 |
| `GET /orders/authenticated` | 我的订单 | 订单、锁券释放触发 | 必须 |
| `GET /orders/:id/authenticated` | 订单详情 | 订单、支付状态、优惠明细 | 必须 |
| `POST /orders/:id/cancel/authenticated` | 顾客取消订单 | 订单状态、释放券 | 必须 |
| `POST /orders/:id/reorder-preview/authenticated` | 再来一单预览 | 当前价格、库存、SKU | 必须 |
| `POST /orders/:id/create-miniapp-payment` | 创建微信支付参数 | 支付、金额、订单状态 | 必须重点真机验收 |
| `POST /orders/miniapp-payment-callback` | 微信支付回调 | 支付验签、幂等、用券 | 必须准生产验收 |
| `GET /coupons/my` | 我的优惠券 | 优惠券状态 | 必须 |
| `GET /coupons/claimable` | 可领取券 | 新人券 | 建议 |
| `POST /coupons/claim` | 领取券 | 发券日志 | 建议 |
| `GET /members/me` | 会员档案 | 会员价、权益 | 必须 |
| `GET /referrals/summary` | 邀请统计 | 邀请入口 | 建议 |
| `POST /referrals/bind` | 绑定邀请关系 | 风控、奖励 | 建议 |
| `POST /auth/exchange-real` | 微信登录换取顾客身份 | 登录、openid 绑定 | 必须 |
| `GET /auth/verify-customer-artifact` | 验证顾客登录态 | 用户身份 | 必须 |

## 上线前重点压测/复测接口

1. 金额相关：`quote-preview/authenticated`、`orders/authenticated`、`create-miniapp-payment`。
2. 库存相关：购物车数量调整、创建订单、支付成功后库存预留/扣减。
3. 优惠券相关：发券、锁券、取消释放、支付成功 USED、重复提交。
4. 支付相关：支付创建、支付回调、重复回调、金额不一致拦截。
5. 登录相关：`exchange-real`、artifact 验证、不同页面身份一致性。

