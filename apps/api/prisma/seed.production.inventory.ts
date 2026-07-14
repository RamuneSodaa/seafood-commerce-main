import {
  runSeedScript,
  assertProductionApplyAllowed,
  printDryRunNotice,
  PRODUCTION_INVENTORY_CANDIDATES,
  requirePrisma
} from './seed.shared';

function validateInventoryCandidate(candidate: (typeof PRODUCTION_INVENTORY_CANDIDATES)[number]) {
  if (candidate.physicalStock < 0) {
    throw new Error(`库存不能为负数：${candidate.storeCode} / ${candidate.skuCode}`);
  }

  if ((candidate.reservedStock || 0) < 0) {
    throw new Error(`预留库存不能为负数：${candidate.storeCode} / ${candidate.skuCode}`);
  }

  if (candidate.safetyStock < 0) {
    throw new Error(`安全库存不能为负数：${candidate.storeCode} / ${candidate.skuCode}`);
  }

  if (candidate.safetyStock > candidate.physicalStock) {
    throw new Error(`安全库存不能大于实物库存：${candidate.storeCode} / ${candidate.skuCode}`);
  }
}

runSeedScript('production inventory seed', async (prisma, options) => {
  assertProductionApplyAllowed(options);

  for (const candidate of PRODUCTION_INVENTORY_CANDIDATES) {
    validateInventoryCandidate(candidate);
  }

  const pendingInventory = PRODUCTION_INVENTORY_CANDIDATES.filter(
    (candidate) => candidate.requiresOperationalConfirmation
  );

  console.log(
    '正式库存候选：',
    PRODUCTION_INVENTORY_CANDIDATES.map((candidate) => ({
      storeCode: candidate.storeCode,
      skuCode: candidate.skuCode,
      physicalStock: candidate.physicalStock,
      safetyStock: candidate.safetyStock,
      reservedStock: candidate.reservedStock || 0,
      requiresOperationalConfirmation: candidate.requiresOperationalConfirmation
    }))
  );

  if (pendingInventory.length > 0 && !options.args.has('--allow-candidate-inventory')) {
    console.log('当前库存数量仍需运营确认。未传入 --allow-candidate-inventory 时，apply 会拒绝写入。');
  }

  if (options.mode === 'dry-run') {
    printDryRunNotice();
    console.log('本 seed 不会把所有 SKU、所有门店默认写成 100；当前候选库存仅用于临时空库演练。');
    return;
  }

  if (pendingInventory.length > 0 && !options.args.has('--allow-candidate-inventory')) {
    throw new Error('正式库存 seed 仍需运营确认。若在空库演练中使用候选库存，请显式传入 --allow-candidate-inventory。');
  }

  const db = requirePrisma(prisma);
  let upserted = 0;
  let availabilityUpserted = 0;

  for (const candidate of PRODUCTION_INVENTORY_CANDIDATES) {
    const store = await db.store.findUnique({ where: { code: candidate.storeCode } });
    if (!store) {
      throw new Error(`找不到门店：${candidate.storeCode}`);
    }

    const sku = await db.sku.findUnique({ where: { code: candidate.skuCode } });
    if (!sku) {
      throw new Error(`找不到 SKU：${candidate.skuCode}`);
    }

    const reservedStock = candidate.reservedStock || 0;
    const availableStock = Math.max(0, candidate.physicalStock - reservedStock);

    await db.storeSkuAvailability.upsert({
      where: { storeId_skuId: { storeId: store.id, skuId: sku.id } },
      update: { isEnabled: candidate.physicalStock > 0 },
      create: {
        storeId: store.id,
        skuId: sku.id,
        isEnabled: candidate.physicalStock > 0
      }
    });
    availabilityUpserted += 1;

    await db.inventory.upsert({
      where: { storeId_skuId: { storeId: store.id, skuId: sku.id } },
      update: {
        physicalStock: candidate.physicalStock,
        availableStock,
        reservedStock,
        safeStock: candidate.safetyStock
      },
      create: {
        storeId: store.id,
        skuId: sku.id,
        physicalStock: candidate.physicalStock,
        availableStock,
        reservedStock,
        damagedStock: 0,
        safeStock: candidate.safetyStock
      }
    });
    upserted += 1;
  }

  console.log('正式库存 seed 完成：', { upserted, availabilityUpserted });
});
