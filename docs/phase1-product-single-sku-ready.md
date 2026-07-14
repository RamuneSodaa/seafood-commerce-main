# Phase 1 Product Single SKU Ready

## 改了什么

- 后端商品创建接口现在支持最小上架闭环：
  - 商品基础信息
  - `coverImageUrl`
  - 1 个默认单 SKU
  - `initialStock`
- 创建时后端统一初始化库存：
  - `physicalStock = initialStock`
  - `availableStock = initialStock`
  - `reservedStock = 0`
- 当前下单链路确实依赖 `StoreSkuAvailability`，所以创建默认 SKU 时会一并创建启用记录。
- storefront web 与 miniapp 商品列表、商品详情已支持展示 `coverImageUrl`。

## 没改什么

- 没有引入多 SKU 管理器
- 没有做图片上传系统，只接收图片 URL
- 没有改支付、登录、订单状态机、库存预留与履约主流程
- 没有改 checkout 接口契约

## 本地补列说明

当前本地库不是 Prisma migrate baseline 接管状态，这次 `coverImageUrl` 补列需要先执行一次 SQL：

```bash
npx prisma db execute --schema prisma/schema.prisma --file prisma/migrations/20260408153000_add_product_cover_image/migration.sql
```

然后重新生成 Prisma Client：

```bash
npx prisma generate
```

## 本地验证

1. 运行 API、admin-web、storefront-web。
2. 在 admin 商品页创建一个新商品，填写：
   - 商品名称
   - 封面图 URL
   - 默认 SKU 名称
   - 价格
   - 初始门店
   - 初始库存
3. 发布该商品。
4. 在 storefront web 与 miniapp 中查看商品列表、商品详情。
5. 继续进入 checkout，确认仍可沿用现有下单链路。
