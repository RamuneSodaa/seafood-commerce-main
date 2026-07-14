/**
 * Phase 2.47A-14 — 批量安全发布器（默认 DRY-RUN，安全）
 *
 * 输入：BULK_PUBLISH_ALLOWED.csv（列含 productId,skuId,name,category,priceCents,...,plannedCoverImageUrl,...）
 * 仅发布满足全部硬条件者；apply 用 productId/skuId 精确执行，单事务，最多 50 个/轮。
 *
 * 硬条件（apply 时对每个商品再次只读校验，任一不满足即 skip）：
 *   internalTag=product_master_cleaned_20260626、isPublished=false、SKU priceCents>0、isActive=true、
 *   plannedCoverImageUrl 对应素材文件存在、门店 code 存在。
 *
 * 安全：默认 dry-run；apply 必须 --apply --confirm-bulk-safe-publish。
 *   事务顺序：set coverImageUrl → create Inventory → create StoreSkuAvailability → set isPublished=true。
 *   不改 priceCents/SKU code；不 delete/drop/truncate/db push/migrate；不按 name 更新；不碰 seed/已发布。
 *
 * 用法：
 *   dry-run：node -r ts-node/register prisma/publish-bulk-safe-products.ts --dry-run --csv <ALLOWED.csv> --assets <dir> [--out <dir>]
 *   apply  ：node -r ts-node/register prisma/publish-bulk-safe-products.ts --apply --confirm-bulk-safe-publish --csv <ALLOWED.csv> --assets <dir>
 */
import { PrismaClient } from '@prisma/client';
// Phase 2.47A-23：防误发布硬保护（占位价/缺图/零价/鲜鱼/legacy seed3）。
import { evaluateProductPublishable } from '../src/modules/products/product-publish-guard';
import * as fs from 'fs';
import * as path from 'path';

const IMPORT_TAG = 'product_master_cleaned_20260626';
const MAX_PER_RUN = 50;
const DEFAULT_STORE = 'STORE_GZ_TH_YUANCUN_MARKET';
const argv = process.argv.slice(2);
const has = (f: string) => argv.includes(f);
const val = (f: string) => { const i = argv.indexOf(f); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined; };
const mode: 'dry-run' | 'apply' = has('--apply') ? 'apply' : 'dry-run';

function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let fld = ''; let row: string[] = []; let q = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"') { if (text[i+1] === '"') { fld += '"'; i++; } else q = false; } else fld += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(fld); fld = ''; }
    else if (c === '\n') { row.push(fld); rows.push(row); row = []; fld = ''; }
    else if (c === '\r') { /* skip */ }
    else fld += c; }
  if (fld.length || row.length) { row.push(fld); rows.push(row); }
  return rows;
}

async function main() {
  const csvPath = val('--csv'); const assetsDir = val('--assets'); const outDir = val('--out');
  if (!csvPath || !fs.existsSync(csvPath)) throw new Error('缺少有效 --csv');
  if (!assetsDir) throw new Error('缺少 --assets');
  if (mode === 'apply' && !has('--confirm-bulk-safe-publish'))
    throw new Error('apply 必须同时传 --apply 与 --confirm-bulk-safe-publish。');

  const grid = parseCsv(fs.readFileSync(csvPath, 'utf-8'));
  const header = grid[0] || [];
  const ix = (n: string) => header.indexOf(n);
  const data = grid.slice(1).filter((r) => r.some((c) => (c || '').trim() !== ''));

  const prisma = new PrismaClient();
  const actions: any[] = [];
  let imgFound = 0, invPlan = 0, availPlan = 0, planPublish = 0, planSkip = 0, warnings = 0;
  try {
    const stores = await prisma.store.findMany({ select: { id: true, code: true } });
    const storeByCode = new Map(stores.map((s) => [s.code, s.id]));

    for (const r of data) {
      if (planPublish >= MAX_PER_RUN) { planSkip++; actions.push({ name: r[ix('name')], decision: 'SKIP', reasons: ['exceeds_50_cap_this_round'] }); continue; }
      const productId = r[ix('productId')]; const skuId = r[ix('skuId')]; const name = r[ix('name')];
      const cover = r[ix('plannedCoverImageUrl')] || r[ix('currentCoverImageUrl')] || '';
      const storeCode = DEFAULT_STORE;
      const reasons: string[] = [];
      const product = await prisma.product.findUnique({ where: { id: productId }, select: { internalTag: true, isPublished: true } });
      const sku = await prisma.sku.findUnique({ where: { id: skuId }, select: { priceCents: true, isActive: true, productId: true } });
      if (!product) reasons.push('product_not_found');
      if (product && product.internalTag !== IMPORT_TAG) reasons.push('not_import_batch');
      if (product && product.isPublished) reasons.push('already_published');
      if (!sku) reasons.push('sku_not_found');
      if (sku && sku.productId !== productId) reasons.push('sku_product_mismatch');
      if (sku && sku.priceCents <= 0) reasons.push('price_zero');
      if (sku && !sku.isActive) reasons.push('sku_inactive');
      const fname = cover.replace(/^assets\/products\//, '');
      const assetOk = fname && fs.existsSync(path.join(assetsDir, fname));
      if (assetOk) imgFound++; else reasons.push('image_asset_missing');
      const storeId = storeByCode.get(storeCode);
      if (!storeId) reasons.push('store_not_found'); else { invPlan++; availPlan++; }
      const decision = reasons.length === 0 ? 'PUBLISH' : 'SKIP';
      if (decision === 'PUBLISH') planPublish++; else planSkip++;
      warnings += reasons.length;
      actions.push({ name, productId, skuId, cover, storeCode, decision, reasons });
    }

    const summary = {
      mode, input_csv: csvPath, cap_per_run: MAX_PER_RUN,
      bulk_publish_allowed_count: data.length,
      planned_cover_backfill_count: actions.filter((a) => a.decision === 'PUBLISH' && a.cover).length,
      planned_inventory_create_count: actions.filter((a) => a.decision === 'PUBLISH').length,
      planned_store_availability_create_count: actions.filter((a) => a.decision === 'PUBLISH').length,
      planned_publish_count: planPublish,
      planned_skip_count: planSkip,
      warnings_count: warnings,
    };
    console.log(`publish-bulk-safe: ${mode.toUpperCase()}`);
    console.log(JSON.stringify(summary, null, 2));
    for (const a of actions) console.log(`  ${a.decision}  ${a.name}  ${(a.reasons || []).join('|') || 'ready'}`);
    if (outDir) { fs.mkdirSync(outDir, { recursive: true }); fs.writeFileSync(`${outDir}/DRY_RUN_SUMMARY.json`, JSON.stringify({ summary, actions }, null, 2)); }

    if (mode === 'dry-run') { console.log('当前为 dry-run，未写入数据库。'); return; }

    let published = 0;
    for (const a of actions) {
      if (a.decision !== 'PUBLISH') continue;
      const storeId = storeByCode.get(a.storeCode)!;
      // Phase 2.47A-23：发布前硬保护，命中则跳过（不写库、不部分写入）。
      const guardTarget = await prisma.product.findUnique({
        where: { id: a.productId },
        select: { id: true, category: true, internalTag: true, coverImageUrl: true, internalNote: true, skus: { select: { priceCents: true, isActive: true } } }
      });
      const guardBlocks = guardTarget
        ? evaluateProductPublishable({ ...guardTarget, coverImageUrl: a.cover ?? guardTarget.coverImageUrl })
        : [{ code: 'PRODUCT_NOT_FOUND', message: 'not found' }];
      if (guardBlocks.length > 0) {
        console.log('GUARD 跳过发布：', a.productId, guardBlocks.map((b) => b.code).join(','));
        continue;
      }
      await prisma.$transaction(async (tx) => {
        await tx.product.update({ where: { id: a.productId }, data: { coverImageUrl: a.cover } });
        await tx.inventory.create({ data: { storeId, skuId: a.skuId, physicalStock: 20, availableStock: 20, reservedStock: 0, damagedStock: 0, safeStock: 5 } });
        await tx.storeSkuAvailability.create({ data: { storeId, skuId: a.skuId, isEnabled: true } });
        await tx.product.update({ where: { id: a.productId }, data: { isPublished: true } });
      });
      published++;
    }
    console.log('bulk-safe publish apply 完成：', { published });
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
