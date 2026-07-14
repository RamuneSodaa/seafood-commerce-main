import { runSeedScript, assertProductionApplyAllowed, printDryRunNotice, PRODUCTION_PRODUCT_CANDIDATES, requirePrisma } from './seed.shared';

runSeedScript('production products seed', async (prisma, options) => {
  assertProductionApplyAllowed(options);

  const pendingProducts = PRODUCTION_PRODUCT_CANDIDATES.filter((product) => product.requiresOperationalConfirmation);

  console.log('正式商品候选：', PRODUCTION_PRODUCT_CANDIDATES.map((product) => ({
    name: product.name,
    category: product.category,
    skuCodes: product.skus.map((sku) => sku.code),
    requiresOperationalConfirmation: product.requiresOperationalConfirmation
  })));

  if (pendingProducts.length > 0 && !options.args.has('--allow-candidate-products')) {
    console.log('当前商品资料仍标记为需要运营确认。未传入 --allow-candidate-products 时，apply 会拒绝写入。');
  }

  if (options.mode === 'dry-run') {
    printDryRunNotice();
    console.log('本 seed 不包含历史 demo 商品，也不会执行 demo cleanup。');
    return;
  }

  if (pendingProducts.length > 0 && !options.args.has('--allow-candidate-products')) {
    throw new Error('正式商品 seed 仍需运营确认。若在空库演练中使用候选商品，请显式传入 --allow-candidate-products。');
  }

  const db = requirePrisma(prisma);
  let productCount = 0;
  let skuCount = 0;

  for (const productData of PRODUCTION_PRODUCT_CANDIDATES) {
    const existingProduct = await db.product.findFirst({ where: { name: productData.name } });
    const product = existingProduct
      ? await db.product.update({
          where: { id: existingProduct.id },
          data: {
            description: productData.description,
            category: productData.category,
            sortOrder: productData.sortOrder,
            isRecommended: productData.isRecommended,
            isPublished: true,
            supportsPickup: true,
            supportsShipping: true
          }
        })
      : await db.product.create({
          data: {
            name: productData.name,
            description: productData.description,
            category: productData.category,
            sortOrder: productData.sortOrder,
            isRecommended: productData.isRecommended,
            isPublished: true,
            supportsPickup: true,
            supportsShipping: true
          }
        });

    productCount += 1;

    for (const skuData of productData.skus) {
      await db.sku.upsert({
        where: { code: skuData.code },
        update: {
          name: skuData.name,
          priceCents: skuData.priceCents
        },
        create: {
          productId: product.id,
          code: skuData.code,
          name: skuData.name,
          priceCents: skuData.priceCents
        }
      });
      skuCount += 1;
    }
  }

  console.log('正式商品 seed 完成：', { productCount, skuCount });
});
