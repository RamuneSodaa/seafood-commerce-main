import { runSeedScript, assertProductionApplyAllowed, printDryRunNotice, PRODUCTION_STORE_CANDIDATES, requirePrisma, summarizeRecords } from './seed.shared';

runSeedScript('production stores seed', async (prisma, options) => {
  assertProductionApplyAllowed(options);

  console.log('正式门店候选：', summarizeRecords(PRODUCTION_STORE_CANDIDATES));

  if (options.mode === 'dry-run') {
    printDryRunNotice();
    console.log('本 seed 不包含 legacy 上海门店、演示门店或测试地址。');
    return;
  }

  const db = requirePrisma(prisma);
  let upserted = 0;

  for (const store of PRODUCTION_STORE_CANDIDATES) {
    await db.store.upsert({
      where: { code: store.code },
      update: {
        name: store.name,
        address: store.address,
        contactName: store.contactName,
        contactPhone: store.contactPhone,
        isActive: true
      },
      create: {
        code: store.code,
        name: store.name,
        address: store.address,
        contactName: store.contactName,
        contactPhone: store.contactPhone,
        isActive: true
      }
    });
    upserted += 1;
  }

  console.log('正式门店 seed 完成：', { upserted });
});
