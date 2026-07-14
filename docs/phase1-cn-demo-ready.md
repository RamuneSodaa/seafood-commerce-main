# 中文版 Phase 1 冻结说明

本文档用于说明当前仓库的中文版 Phase 1 冻结状态，帮助团队统一理解当前版本的中文化范围、术语口径、演示方式与冻结边界。

## A. 中文版当前状态总结

当前版本已经适合作为“中文版 Phase 1 演示版”保留。

已完成的中文化范围：

- storefront
- 顶部导航、页面标题、副标题、按钮、空状态、错误提示、成功提示
- 商品列表、商品详情、下单页、订单列表、订单详情
- 订单状态显示、履约方式显示、下一步提示、自提/发货信息区
- admin
- 顶部导航、首页总览、摘要卡片、模块标题
- 订单作业台、订单详情、库存页、商品管理页、门店页
- 状态 badge、动作按钮、字段标题、空状态、反馈提示
- 演示数据
- 主要 seed 门店名、商品名、商品描述、联系人、地址、收货人已中文化
- checkout 默认演示地址已中文化
- 默认快递公司展示文案已中文化

整体状态：

- 中文显示层已经基本完整
- 前后台构建通过
- seed 已验证可执行
- 主流程脚本可继续使用
- 不需要再为“中文演示”做大范围结构改动

## B. 保留英文的合理边界

以下英文保留是合理的，不建议为了演示继续强改：

- 内部枚举原值
- `PENDING_PAYMENT`
- `READY_FOR_PICKUP`
- `STORE_PICKUP`
- `SHIPPING`
- 路由路径
- `/orders`
- `/products`
- `/inventory`
- `/stores`
- 接口字段名 / query 参数
- `productId`
- `skuId`
- `customerId`
- `storeId`
- 编码类值
- `STORE_SH_001`
- `SALMON-500G-*`
- `SF-*`
- 技术缩写
- `SKU`

这些属于系统实现层、接口层或业务编码层，不影响中文演示的主体体验。

可选进一步中文化项，但不是当前冻结阻塞：

- `SKU` 是否要在部分页面显示成“规格 / SKU”
- 编码展示策略是否需要弱化，例如少展示内部编码、多展示业务名称
- seed 控制台日志如 `Seed completed` 是否也改成中文
- 个别 demo 编号前缀是否需要更贴近中文业务场景

这些都属于“可选优化项”，不是当前版本的缺陷。

## C. 系统中文术语表

以下术语建议作为当前版本统一口径，前后台都按这一套说法使用。

- `Shop` -> `商品`
- `Product detail` -> `商品详情`
- `Checkout` -> `下单`
- `Orders` -> `订单`
- `Order detail` -> `订单详情`

- `Store pickup` -> `到店自提`
- `Shipping` -> `邮寄发货`

- `Admin console` -> `后台控制台`
- `Order workbench` / `Workbench Orders` -> `订单作业台`
- `Inventory workbench` -> `库存作业台`
- `Product management` -> `商品管理`
- `Store management` -> `门店管理`

- `Pending payment` -> `待支付`
- `Paid, preparing pickup` / `Preparing pickup` -> `待备货`
- `Ready for pickup` -> `待取货`
- `Awaiting shipment` / `Paid, awaiting shipment` -> `待发货`
- `Shipped` -> `已发货`
- `Delivered` -> `已送达`
- `Completed` -> `已完成`
- `Cancelled` -> `已取消`
- `After sales` -> `售后中`

- `Order total` -> `订单金额`
- `Quantity` -> `数量`
- `Line total` -> `小计`
- `Unit price` -> `单价`
- `Shipping address` -> `收货地址`
- `Shipment tracking` -> `物流跟踪`
- `Pickup code` -> `提货码`

- `Primary actions` -> `主要动作`
- `Next step` -> `下一步`
- `Status timeline` -> `状态时间线`
- `Inventory rows` -> `库存记录数`
- `Physical stock` -> `实物库存`
- `Available stock` -> `可售库存`
- `Reserved stock` -> `预留库存`
- `Safe stock` -> `安全库存`
- `Damaged stock` -> `残损库存`

## D. 中文演示路径

### storefront 演示

1. 从首页进入，展示商品列表与中文导航。
2. 打开商品详情，展示规格、价格、履约方式说明。
3. 进入下单页，展示“到店自提 / 邮寄发货”的差异。
4. 提交订单后进入订单详情，展示中文状态、履约信息和时间线。
5. 返回订单列表，展示顾客视角的订单追踪能力。

最适合展示的页面：

- `/`
- `/products/[id]`
- `/checkout`
- `/orders`
- `/orders/[id]`

### admin 演示

1. 从后台首页进入，展示统一中文后台壳层。
2. 进入订单作业台，展示订单状态与履约动作。
3. 打开订单详情，演示“标记待取货 / 完成取货 / 执行发货 / 标记已送达”。
4. 打开库存页，展示实物/可售/预留关系与风险提示。
5. 打开商品管理和门店页，展示中文化后的后台管理视图。

最适合展示的页面：

- `/`
- `/workbench/orders`
- `/workbench/orders/[id]`
- `/inventory`
- `/products`
- `/stores`

### 可跑主流程的脚本

- `./phase1-pickup.sh <order-id> <customer-id> <pickup-code> [paid-amount-cents]`
- `./phase1-shipping.sh <order-id> <customer-id> [paid-amount-cents]`

这两个脚本分别用于演示：

- `到店自提` 主流程
- `邮寄发货` 主流程

## E. 是否建议把当前版本冻结为中文演示版，以及建议版本名

建议冻结。

当前版本已经具备这些条件：

- 中文界面主体完整
- 前后台主链路可演示
- 订单状态与履约路径中文统一
- 演示数据主要可见部分已中文化
- build、seed、主流程脚本都已验证

建议版本名：

- 首选：`phase1-cn-demo-ready`
- 如果你想强调已完成工程收尾：`phase1-cn-freeze`
- 如果你想强调这是正式保留的中文版：`phase1-cn-showcase`

建议优先使用 `phase1-cn-demo-ready`。它最准确表达当前状态：已经适合稳定做中文演示，同时不暗示项目已经进入下一阶段的大规模产品化开发。
