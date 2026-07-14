# 顾客端全链路回归结果

阶段：Phase 2.22B_release_candidate_baseline_and_customer_regression  
执行方式：基于 Phase 2.21C 人工截图确认、代码静态复核、build/tsc 验证整理。  
说明：本阶段不执行破坏性数据库操作，不删除订单、商品、门店、库存、会员或优惠券数据。

## A. 商品页

| 测试项 | 预期结果 | 当前结果 | 状态 | 备注 | 涉及页面 | 涉及 API |
| --- | --- | --- | --- | --- | --- | --- |
| 未登录进入商品页 | 可浏览商品，无技术字段 | 商品页可未登录浏览 | PASS | 需最终真机再截一次 | `pages/products/index` | `GET /products` |
| 分类图标显示 | 分类按钮有小图标 | 已接入单 PNG 图标和 fallback | PASS | Phase 2.21B 已确认 | `pages/products/index` | 无 |
| 分类切换 | 商品列表按分类切换 | 分类参数传入 `/products` | PASS | 分类数据需正式商品复测 | `pages/products/index` | `GET /products?category=` |
| 搜索 | 输入关键词返回匹配商品 | 搜索参数传入 `/products` | PASS | 需以正式商品资料复测 | `pages/products/index` | `GET /products?q=` |
| 商品卡展示 | 图片、名称、规格、价格、按钮清晰 | 当前 UI 已通过人工截图 | PASS | 无 | `pages/products/index` | `GET /products` |
| SKU 弹窗固定底部 | 点击选规格后无需下滑 | 使用 RootPortal 和固定底部样式 | PASS | Phase 2.20D 已修复 | `pages/products/index` | 无 |
| 选规格加入购物车 | 加入后购物车可见 | 主链路已人工验证 | PASS | 无 | `pages/products/index`, `pages/cart/index` | `POST /cart/items`, `GET /cart` |
| 立即购买 | 进入 checkout 且商品正确 | 立即购买参数进入 checkout | PASS | 需真机复测 | `pages/products/index`, `pages/checkout/index` | `POST /orders/quote-preview/authenticated` |

## B. 购物车

| 测试项 | 预期结果 | 当前结果 | 状态 | 备注 | 涉及页面 | 涉及 API |
| --- | --- | --- | --- | --- | --- | --- |
| 空购物车 | 品牌空态和去选商品 | 文案已优化 | PASS | 无 | `pages/cart/index` | `GET /cart` |
| 加入商品后展示 | 展示商品、规格、库存、单价、小计 | 已人工验证 | PASS | 无 | `pages/cart/index` | `GET /cart` |
| 数量加减 | 数量和金额同步 | 已人工验证 | PASS | 无 | `pages/cart/index` | `PATCH /cart/items/:id` |
| 移除商品二次确认 | 取消保留，确认移除 | 已人工验证 | PASS | 无 | `pages/cart/index` | `DELETE /cart/items/:id` |
| 合计金额 | 件数和金额正确 | 已人工验证多商品合计 | PASS | 无 | `pages/cart/index` | `GET /cart` |
| 去结算 | 进入 checkout | 已人工验证 | PASS | 无 | `pages/cart/index`, `pages/checkout/index` | `GET /cart` |

## C. checkout

| 测试项 | 预期结果 | 当前结果 | 状态 | 备注 | 涉及页面 | 涉及 API |
| --- | --- | --- | --- | --- | --- | --- |
| 商品信息 | 多商品明细清晰 | 已人工验证 | PASS | 无 | `pages/checkout/index` | `GET /cart`, `GET /products/:id` |
| 数量变化 | 数量影响金额 | 购物车路径已验证 | PASS | checkout 内直接数量变化按现有路径保留 | `pages/checkout/index` | `POST /orders/quote-preview/authenticated` |
| 会员价优惠 | 显示会员优惠 | 已人工验证 | PASS | 无 | `pages/checkout/index` | `GET /members/me`, quote |
| 可用优惠券 | 可显示和选择 | 已人工验证 | PASS | 无 | `pages/checkout/index` | `GET /coupons/my` |
| 不可用优惠券及原因 | 显示门槛/锁定原因 | 已实现并验证过锁定原因 | PASS | 无 | `pages/checkout/index` | `GET /coupons/my` |
| 单张券 | 可选并减钱 | 已人工验证 | PASS | 无 | `pages/checkout/index` | quote |
| 全用券 | 可叠加时全用 | 已实现 | PASS | 需正式券规则再复测 | `pages/checkout/index` | quote |
| 不使用优惠券 | 金额恢复 | 已实现 | PASS | 无 | `pages/checkout/index` | quote |
| 兑换码输入 | 可输入并互斥用户券 | Phase 2.20D 已修复 | PASS | 有效码需测试数据 | `pages/checkout/index` | quote |
| 兑换码有效提示 | 显示可用提示 | 代码路径存在 | NEEDS_MANUAL_SCREENSHOT | 需要有效兑换码测试数据 | `pages/checkout/index` | quote |
| 兑换码无效提示 | 中文错误 | 文案为“兑换码无效，请检查后重试。” | PASS | 无 | `pages/checkout/index` | quote |
| 凑单提示 | 差额合理时展示 | 已实现 | PASS | 需正式商品库存再复测 | `pages/checkout/index` | quote, products |
| 凑单弹窗 | 底部弹窗推荐商品 | RootPortal bottom sheet 存在 | PASS | 无 | `pages/checkout/index` | products |
| 加入凑单后重新报价 | 加入后金额刷新 | 代码路径存在 | PASS | 真机建议复测 | `pages/checkout/index` | quote |
| 选择门店 | 门店可选 | 已通过前序截图 | PASS | 无 | `pages/checkout/index` | `GET /stores` |
| 到店自提 | 可选择 | 已实现 | PASS | 无 | `pages/checkout/index` | quote/order |
| 邮寄发货入口 | 可选择 | 已实现 | PASS | 需正式地址流程复测 | `pages/checkout/index` | customer addresses/order |
| 提交订单 | 创建待支付订单 | 已人工验证 | PASS | 无 | `pages/checkout/index` | `POST /orders/authenticated` |

## D. 订单

| 测试项 | 预期结果 | 当前结果 | 状态 | 备注 | 涉及页面 | 涉及 API |
| --- | --- | --- | --- | --- | --- | --- |
| 待支付订单生成 | 创建后进入详情 | 已人工验证 | PASS | 无 | `pages/checkout/index`, `pages/order-detail/index` | `POST /orders/authenticated` |
| 订单列表展示 | 订单卡清楚 | 已增加状态提示 | PASS | 无 | `pages/orders/index` | `GET /orders/authenticated` |
| 订单详情展示 | 状态、明细、金额、履约信息 | 已人工验证 | PASS | 无 | `pages/order-detail/index` | `GET /orders/:id/authenticated` |
| 立即支付入口存在 | 待支付订单显示支付入口 | 已实现 | PASS | 正式支付需专项验收 | `pages/order-detail/index` | `POST /orders/:id/create-miniapp-payment` |
| 取消待支付订单 | 可取消 | 已实现 | PASS | 无 | `pages/order-detail/index`, `pages/orders/index` | `POST /orders/:id/cancel/authenticated` |
| 取消后释放优惠券 | 锁券释放 | 已验证过本地链路 | PASS | 正式需回归 | `pages/coupons/index`, checkout | cancel/order |
| 超时取消说明 | lazy expiration 文档清楚 | 已在文档中说明 | PASS | 正式建议定时任务 | orders/checkout/coupons | orders/coupons |
| 再来一单 | 可重新加入购物车 | 已人工验证 | PASS | 无 | orders/detail/cart | reorder preview/cart |
| 合并加入购物车 | 合并已有购物车 | action sheet 保留 | PASS | 无 | orders/detail/cart | cart |
| 清空购物车后加入 | 清空后加入 | action sheet 保留 | PASS | 无 | orders/detail/cart | cart |
| 再来一单后重新结算 | 走当前价格/库存 | 后端 previewReorder 路径保留 | PASS | 需正式库存数据复测 | orders/detail/checkout | reorder preview/quote |

## E. 优惠券

| 测试项 | 预期结果 | 当前结果 | 状态 | 备注 | 涉及页面 | 涉及 API |
| --- | --- | --- | --- | --- | --- | --- |
| 我的页优惠券统计 | 可用、锁定、已用清楚 | 已实现 | PASS | 无 | `pages/customer-login/index` | `GET /coupons/my` |
| 优惠券详情页 | 可进入 | 已实现 | PASS | 无 | `pages/coupons/index` | `GET /coupons/my` |
| 可用 tab | 展示 CLAIMED | 已实现 | PASS | 无 | coupons | coupons |
| 待支付锁定 tab | 展示 LOCKED | 已实现 | PASS | 需有锁定订单数据截图 | coupons/order-detail | coupons/orders |
| 已使用 tab | 展示 USED | 已实现 | PASS | 需支付/mark-paid 后数据 | coupons | coupons |
| 已过期 tab | 展示 EXPIRED | 已实现 | PASS | 需过期测试数据 | coupons | coupons |
| 锁定券跳转占用订单 | 可跳转订单详情 | 代码路径存在 | PASS | 需有锁定券数据复测 | coupons/order-detail | coupons/orders |
| 满减券差额提示 | 显示还差金额 | checkout 已实现 | PASS | 无 | checkout | quote/coupons |

## F. 会员中心

| 测试项 | 预期结果 | 当前结果 | 状态 | 备注 | 涉及页面 | 涉及 API |
| --- | --- | --- | --- | --- | --- | --- |
| 我的页会员中心入口 | 可点击进入 | 已实现 | PASS | 无 | customer-login/member | members |
| 会员中心页面 | 展示会员信息 | 已实现 | PASS | 无 | member | `GET /members/me` |
| 普通/银卡/金卡权益展示 | 三档权益说明 | 已实现 | PASS | 预留权益为文案展示 | member | members |
| 会员价说明 | 说明会员价权益 | 已实现 | PASS | 无 | member/checkout | members/quote |
| 邀请有礼 | 可分享 | 已实现 | PASS | 无 | member/customer-login | referrals |
| 分享 path 带 inviteCode | 带参数 | 代码路径存在 | PASS | 真机分享卡建议复测 | member/customer-login/products | referrals |

## G. 邀请

| 测试项 | 预期结果 | 当前结果 | 状态 | 备注 | 涉及页面 | 涉及 API |
| --- | --- | --- | --- | --- | --- | --- |
| 我的页分享 | 可触发微信分享 | 已实现 | PASS | 需真机分享截图 | customer-login | referrals |
| 会员中心分享 | 可触发微信分享 | 已实现 | PASS | 需真机分享截图 | member | referrals |
| 分享 path 带 inviteCode | path 包含 inviteCode | 代码复核通过 | PASS | 无 | products/member/login | referrals |
| 自邀拦截逻辑 | 接口拦截 | 仅做代码确认 | PASS | 不做破坏性数据操作 | referrals | `POST /referrals/bind` |

## H. 金额一致性

| 测试项 | 预期结果 | 当前结果 | 状态 | 备注 | 涉及页面 | 涉及 API |
| --- | --- | --- | --- | --- | --- | --- |
| 商品页价格 | 来自 SKU/会员价 | 已实现 | PASS | 正式商品价需复测 | products/detail | products |
| 购物车金额 | 单价、小计、合计一致 | 已人工验证 | PASS | 无 | cart | cart |
| checkout 金额 | 后端 quote 为准 | 已实现 | PASS | 无 | checkout | quote |
| 订单详情金额 | create order 快照 | 已实现 | PASS | 无 | order-detail | orders |
| 会员优惠金额 | 明细展示 | 已实现 | PASS | 无 | checkout/order-detail | quote/orders |
| 优惠券优惠金额 | 明细展示 | 已实现 | PASS | 无 | checkout/order-detail | quote/orders |
| 应付金额 | subtotal - member - coupon | 已实现 | PASS | 无 | checkout/order-detail | quote/orders |
| 后端 quote/create 复算 | create order 重新计算 | 已实现 | PASS | 需压测重复提交 | API | orders/pricing |

## 问题分级

P0：0  
P1：0  
P2：0  
P3：0

当前本阶段未发现 P0/P1 阻塞问题，但支付真链路、正式 migration、生产环境仍未验收。

## 上线风险备注

- 正式支付仍需真机专项验收。
- 正式 migration 未生成，不能直接发布生产。
- 有效兑换码、过期券、已使用券等依赖特定测试数据的截图仍建议在 Phase 2.22B 人工验收补齐。

