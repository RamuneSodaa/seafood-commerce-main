/**
 * Phase 2.48H — 新鲜渔产测试参考价/斤 + 激活 + 库存/门店可售（默认 DRY-RUN，安全）
 *
 * 仅处理 internalTag=fresh_seafood_catalog 的 34 个商品（按 name 精确匹配，fresh 内名称唯一）。
 *   - 更新其默认 SKU：priceCents=参考价×100，isActive=true
 *   - 创建 Inventory（主门店 STORE_GZ_TH_YUANCUN_MARKET，physical=20/available=20/reserved=0/safe=5）
 *   - 创建 StoreSkuAvailability（主门店，isEnabled=true）
 *   - 更新 Product.internalNote：testReferencePrice=true, unit=斤, priceMode=REFERENCE_MARKET_PRICE
 *
 * 安全：默认 dry-run；apply 需 --apply --confirm-fresh-reference-prices；apply 前校验库名=seafood_phase1_realdev。
 *   只 update fresh SKU 的 priceCents/isActive；只 create fresh Inventory/Availability；只 update fresh Product.internalNote。
 *   不动 dry 商品；不 delete/drop/truncate/db push/migrate；不创建新 Product/Sku；不发布 fresh（isPublished 不变）。
 */
import { PrismaClient } from '@prisma/client';

const FRESH_TAG = 'fresh_seafood_catalog';
const STORE_CODE = 'STORE_GZ_TH_YUANCUN_MARKET';
const argv = process.argv.slice(2);
const has = (f: string) => argv.includes(f);
const mode: 'dry-run' | 'apply' = has('--apply') ? 'apply' : 'dry-run';

// 参考价（元/斤）。仅测试参考价，非最终门店价。
const PRICE_YUAN_PER_JIN: Record<string, number> = {
  野生大米仓: 48, 野生龙利鱼: 38, 野生花泥猛: 45, 野生黄钻沙尖: 38, 野生花斑虾: 68,
  野生章鱼: 38, 野生鱿鱼: 32, 野生金昌鱼: 35, 野生马友: 58, 野生斗昌: 68,
  野生明丁公: 42, 野生黄尾: 46, 野生杂鱼: 28, 野生铁甲: 42, 野生海狼: 36,
  野生红友: 68, 野生金钱斑: 88, 野生长尾鲳: 42, 野生软唇: 52, 野生鸡笼仓: 48,
  野生石头鱼: 78, 野生脐鱼: 42, 野生松鱼: 36, 野生剥皮牛: 38, 野生青衣: 98,
  野生青斑: 88, 野生腊鱼: 42, 野生泥鱼: 32, 野生大明虾: 68, 野生小九虾: 48,
  野生金线鱼: 38, 野生红杉鱼: 42, 野生石九公: 58, 野生小蚝: 18
};

async function main() {
  if (mode === 'apply' && !has('--confirm-fresh-reference-prices'))
    throw new Error('apply 必须同时传 --apply 与 --confirm-fresh-reference-prices。');
  const prisma = new PrismaClient();
  try {
    const dbn = await prisma.$queryRawUnsafe<any[]>('SELECT current_database() AS db');
    const dbName = dbn?.[0]?.db;
    if (mode === 'apply' && dbName !== 'seafood_phase1_realdev')
      throw new Error(`apply 仅允许写 seafood_phase1_realdev，当前=${dbName}，已停止。`);

    const store = await prisma.store.findUnique({ where: { code: STORE_CODE }, select: { id: true } });
    if (!store) throw new Error(`找不到主门店 ${STORE_CODE}`);

    const fresh = await prisma.product.findMany({
      where: { internalTag: FRESH_TAG },
      select: { id: true, name: true, internalNote: true, isPublished: true, skus: { select: { id: true, code: true, priceCents: true, isActive: true } } }
    });

    const conflicts: string[] = [];
    let planPrice = 0, planActivate = 0, planInv = 0, planAvail = 0;
    const plan: Array<{ pid: string; sid: string; name: string; priceCents: number }> = [];
    for (const p of fresh) {
      const yuan = PRICE_YUAN_PER_JIN[p.name];
      if (yuan === undefined) { conflicts.push(`no_price_for:${p.name}`); continue; }
      if (p.skus.length !== 1) { conflicts.push(`sku_count_${p.skus.length}:${p.name}`); continue; }
      if (p.isPublished) { conflicts.push(`unexpected_published:${p.name}`); continue; }
      const sku = p.skus[0];
      plan.push({ pid: p.id, sid: sku.id, name: p.name, priceCents: yuan * 100 });
      planPrice++; planActivate++; planInv++; planAvail++;
    }

    const summary = {
      mode, db: dbName,
      fresh_product_count: fresh.length,
      planned_price_update_count: planPrice,
      planned_sku_activate_count: planActivate,
      planned_inventory_create_count: planInv,
      planned_store_availability_create_count: planAvail,
      dry_product_update_count: 0,
      dry_sku_update_count: 0,
      conflict_count: conflicts.length,
      warnings_count: conflicts.length
    };
    console.log(`fresh reference-price: ${mode.toUpperCase()}`);
    console.log(JSON.stringify(summary, null, 2));
    if (conflicts.length) console.log('conflicts:', conflicts);

    if (mode === 'dry-run') { console.log('当前为 dry-run，未写入数据库。'); return; }
    if (conflicts.length) throw new Error('存在冲突，停止 apply。');

    let priced = 0, inv = 0, avail = 0;
    for (const it of plan) {
      const product = fresh.find((f) => f.id === it.pid)!;
      let note: any = {};
      try { note = product.internalNote ? JSON.parse(product.internalNote) : {}; } catch { note = {}; }
      note.testReferencePrice = true;
      note.unit = '斤';
      note.priceMode = 'REFERENCE_MARKET_PRICE';
      note.referencePriceYuanPerJin = it.priceCents / 100;
      note.note = '测试参考价，实际价格以门店称重确认为准';
      await prisma.$transaction(async (tx) => {
        await tx.sku.update({ where: { id: it.sid }, data: { priceCents: it.priceCents, isActive: true } });
        await tx.inventory.create({ data: { storeId: store.id, skuId: it.sid, physicalStock: 20, availableStock: 20, reservedStock: 0, damagedStock: 0, safeStock: 5 } });
        await tx.storeSkuAvailability.create({ data: { storeId: store.id, skuId: it.sid, isEnabled: true } });
        await tx.product.update({ where: { id: it.pid }, data: { internalNote: JSON.stringify(note) } });
      });
      priced++; inv++; avail++;
    }
    console.log('fresh reference-price apply 完成：', { priced, inv, avail });
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
