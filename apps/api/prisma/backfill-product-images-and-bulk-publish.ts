/**
 * Phase 2.47A-15 — 图片回填 + 批量安全发布（默认 DRY-RUN，安全）
 *
 * 输入：BULK_PUBLISH_ALLOWED_AFTER_IMAGE_RESCAN.csv
 *   关键列：productId, skuId, plannedCoverImageUrl (assets/products/product_xxx_cover.jpg)
 *   可选列：sourceImagePath（若目标资产缺失才用于复制；本轮目标均已存在，故不复制）
 *
 * 安全：
 *   - 默认 dry-run；apply 必须 --apply --confirm-image-backfill-and-bulk-publish。
 *   - 图片：仅当目标资产缺失且提供 sourceImagePath 时复制；若目标已存在且 sha256 不同 → 冲突 skip，不覆盖；相同 → 跳过。
 *   - DB：按 productId/skuId 精确；单事务顺序 set coverImageUrl → create Inventory → create StoreSkuAvailability → set isPublished=true。
 *   - 不改 priceCents / SKU code；不 delete/drop/truncate/db push/migrate；不按 name 更新。
 *   - 硬条件任一不满足即 skip。50 个/轮上限。
 *
 * 用法：
 *   dry-run：node -r ts-node/register prisma/backfill-product-images-and-bulk-publish.ts --dry-run --csv <CSV> --assets <dir> [--out <dir>]
 *   apply  ：node -r ts-node/register prisma/backfill-product-images-and-bulk-publish.ts --apply --confirm-image-backfill-and-bulk-publish --csv <CSV> --assets <dir>
 */
import { PrismaClient } from '@prisma/client';
// Phase 2.47A-23：防误发布硬保护（占位价/缺图/零价/鲜鱼/legacy seed3）。
import { evaluateProductPublishable } from '../src/modules/products/product-publish-guard';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const IMPORT_TAG = 'product_master_cleaned_20260626';
const MAX_PER_RUN = 50;
const DEFAULT_STORE = 'STORE_GZ_TH_YUANCUN_MARKET';
const argv = process.argv.slice(2);
const has = (f: string) => argv.includes(f);
const val = (f: string) => { const i = argv.indexOf(f); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined; };
const mode: 'dry-run' | 'apply' = has('--apply') ? 'apply' : 'dry-run';

function parseCsv(t: string): string[][] {
  const rows: string[][] = []; let fld = ''; let row: string[] = []; let q = false;
  for (let i = 0; i < t.length; i++) { const c = t[i];
    if (q) { if (c === '"') { if (t[i+1] === '"') { fld += '"'; i++; } else q = false; } else fld += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(fld); fld = ''; }
    else if (c === '\n') { row.push(fld); rows.push(row); row = []; fld = ''; } else if (c === '\r') {} else fld += c; }
  if (fld.length || row.length) { row.push(fld); rows.push(row); }
  return rows;
}
const sha256 = (p: string) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

async function main() {
  const csvPath = val('--csv'); const assetsDir = val('--assets'); const outDir = val('--out');
  if (!csvPath || !fs.existsSync(csvPath)) throw new Error('缺少有效 --csv');
  if (!assetsDir) throw new Error('缺少 --assets');
  if (mode === 'apply' && !has('--confirm-image-backfill-and-bulk-publish'))
    throw new Error('apply 必须同时传 --apply 与 --confirm-image-backfill-and-bulk-publish。');

  const grid = parseCsv(fs.readFileSync(csvPath, 'utf-8'));
  const header = grid[0] || []; const ix = (n: string) => header.indexOf(n);
  const data = grid.slice(1).filter((r) => r.some((c) => (c || '').trim() !== ''));

  const prisma = new PrismaClient();
  const actions: any[] = [];
  let assetCopy = 0, coverBackfill = 0, invCreate = 0, availCreate = 0, planPublish = 0, planSkip = 0, warnings = 0, conflicts = 0;
  try {
    const stores = await prisma.store.findMany({ select: { id: true, code: true } });
    const storeByCode = new Map(stores.map((s) => [s.code, s.id]));
    for (const r of data) {
      if (planPublish >= MAX_PER_RUN) { planSkip++; actions.push({ name: r[ix('name')], decision: 'SKIP', reasons: ['exceeds_50_cap'] }); continue; }
      const productId = r[ix('productId')]; const skuId = r[ix('skuId')]; const name = r[ix('name')];
      const cover = r[ix('plannedCoverImageUrl')] || ''; const srcCol = ix('sourceImagePath');
      const sourceImagePath = srcCol >= 0 ? r[srcCol] : '';
      const reasons: string[] = []; let willCopy = false;
      // DB read-only validate
      const product = await prisma.product.findUnique({ where: { id: productId }, select: { internalTag: true, isPublished: true } });
      const sku = await prisma.sku.findUnique({ where: { id: skuId }, select: { priceCents: true, isActive: true, productId: true } });
      if (!product) reasons.push('product_not_found');
      if (product && product.internalTag !== IMPORT_TAG) reasons.push('not_import_batch');
      if (product && product.isPublished) reasons.push('already_published');
      if (!sku) reasons.push('sku_not_found');
      if (sku && sku.productId !== productId) reasons.push('sku_product_mismatch');
      if (sku && sku.priceCents <= 0) reasons.push('price_zero');
      if (sku && !sku.isActive) reasons.push('sku_inactive');
      if (!cover.startsWith('assets/products/')) reasons.push('cover_path_invalid');
      // asset handling
      const fname = cover.replace(/^assets\/products\//, '');
      const target = path.join(assetsDir, fname);
      if (fs.existsSync(target)) {
        if (sourceImagePath && fs.existsSync(sourceImagePath) && sha256(sourceImagePath) !== sha256(target)) {
          reasons.push('asset_conflict_diff_sha'); conflicts++;
        }
      } else if (sourceImagePath && fs.existsSync(sourceImagePath)) {
        willCopy = true;
      } else {
        reasons.push('target_asset_missing_no_source');
      }
      const storeId = storeByCode.get(DEFAULT_STORE);
      if (!storeId) reasons.push('store_not_found');
      const decision = reasons.length === 0 ? 'PUBLISH' : 'SKIP';
      if (decision === 'PUBLISH') { planPublish++; coverBackfill++; invCreate++; availCreate++; if (willCopy) assetCopy++; }
      else planSkip++;
      warnings += reasons.length;
      actions.push({ name, productId, skuId, cover, sourceImagePath, willCopy, target, storeId, decision, reasons });
    }
    const summary = {
      mode, input_csv: csvPath, cap_per_run: MAX_PER_RUN,
      image_backfill_allowed_count: data.length,
      planned_asset_copy_count: assetCopy,
      planned_cover_backfill_count: coverBackfill,
      planned_inventory_create_count: invCreate,
      planned_store_availability_create_count: availCreate,
      planned_publish_count: planPublish,
      planned_skip_count: planSkip,
      conflict_count: conflicts,
      warnings_count: warnings,
    };
    console.log(`image-backfill-bulk-publish: ${mode.toUpperCase()}`);
    console.log(JSON.stringify(summary, null, 2));
    for (const a of actions) console.log(`  ${a.decision}  ${a.name}  ${(a.reasons || []).join('|') || 'ready'}`);
    if (outDir) { fs.mkdirSync(outDir, { recursive: true }); fs.writeFileSync(`${outDir}/DRY_RUN_SUMMARY.json`, JSON.stringify({ summary, actions }, null, 2)); }
    if (mode === 'dry-run') { console.log('当前为 dry-run，未写入数据库，未复制文件。'); return; }

    let published = 0, copied = 0;
    for (const a of actions) {
      if (a.decision !== 'PUBLISH') continue;
      // Phase 2.47A-23：发布前硬保护，命中则跳过（在复制图片/写库之前）。
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
      if (a.willCopy) { fs.copyFileSync(a.sourceImagePath, a.target); copied++; }   // only if target was missing
      await prisma.$transaction(async (tx) => {
        await tx.product.update({ where: { id: a.productId }, data: { coverImageUrl: a.cover } });
        await tx.inventory.create({ data: { storeId: a.storeId, skuId: a.skuId, physicalStock: 20, availableStock: 20, reservedStock: 0, damagedStock: 0, safeStock: 5 } });
        await tx.storeSkuAvailability.create({ data: { storeId: a.storeId, skuId: a.skuId, isEnabled: true } });
        await tx.product.update({ where: { id: a.productId }, data: { isPublished: true } });
      });
      published++;
    }
    console.log('apply 完成：', { published, assetCopied: copied });
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
