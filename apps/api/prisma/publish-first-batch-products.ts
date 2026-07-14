/**
 * Phase 2.47A-11 — 第一批真实商品发布执行器（默认 DRY-RUN，安全）
 *
 * 输入：FIRST_BATCH_SAFE_CANDIDATES.csv
 *   列：productId,skuId,name,category,priceCents,coverImageFile,imageGrade,storeCode,plannedPhysicalStock,plannedSafeStock
 *
 * 安全设计（本阶段只 dry-run，不写库）：
 *   - 默认 dry-run；apply 必须同时 --apply --confirm-first-batch-publish。
 *   - apply（未来）按单事务执行，顺序：回填 coverImageUrl → 创建 Inventory → 创建 StoreSkuAvailability → 最后 isPublished=true。
 *   - 任一前置缺失（图片素材文件不存在 / 库存计划缺 / 门店可售计划缺 / 门店不存在）→ 该商品 skip，不发布。
 *   - 不修改 priceCents；不发布未定价(priceCents<=0)或 isActive=false 的 SKU。
 *   - 不覆盖 seed 商品（只处理 internalTag=product_master_cleaned_20260626）。
 *   - 不处理 271 未定价商品（只处理输入 CSV 中的 SAFE 候选）。
 *
 * 用法：
 *   dry-run（本阶段）：
 *     node -r ts-node/register prisma/publish-first-batch-products.ts --dry-run \
 *       --csv "<abs FIRST_BATCH_SAFE_CANDIDATES.csv>" --assets "<abs assets/products dir>" --out "<abs report dir>"
 *   apply（下一阶段，需双旗标，本阶段禁止）：
 *     node -r ts-node/register prisma/publish-first-batch-products.ts \
 *       --apply --confirm-first-batch-publish --csv "<...>" --assets "<...>"
 */
import { PrismaClient } from '@prisma/client';
// Phase 2.47A-23：防误发布硬保护（占位价/缺图/零价/鲜鱼/legacy seed3）。
import { evaluateProductPublishable } from '../src/modules/products/product-publish-guard';
import * as fs from 'fs';
import * as path from 'path';

const IMPORT_TAG = 'product_master_cleaned_20260626';
const argv = process.argv.slice(2);
const has = (f: string) => argv.includes(f);
const val = (f: string) => { const i = argv.indexOf(f); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined; };
const mode: 'dry-run' | 'apply' = has('--apply') ? 'apply' : 'dry-run';

function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let fld = ''; let row: string[] = []; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { fld += '"'; i++; } else q = false; } else fld += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(fld); fld = ''; }
    else if (c === '\n') { row.push(fld); rows.push(row); row = []; fld = ''; }
    else if (c === '\r') { /* skip */ }
    else fld += c;
  }
  if (fld.length || row.length) { row.push(fld); rows.push(row); }
  return rows;
}

async function main() {
  const csvPath = val('--csv');
  const assetsDir = val('--assets');
  const outDir = val('--out');
  if (!csvPath || !fs.existsSync(csvPath)) throw new Error('缺少有效 --csv');
  if (!assetsDir) throw new Error('缺少 --assets（assets/products 目录）');
  if (mode === 'apply' && !has('--confirm-first-batch-publish'))
    throw new Error('apply 必须同时传 --apply 与 --confirm-first-batch-publish，默认只允许 dry-run。');

  const grid = parseCsv(fs.readFileSync(csvPath, 'utf-8'));
  const header = grid[0];
  const idx = (n: string) => header.indexOf(n);
  const data = grid.slice(1).filter((r) => r.some((c) => (c || '').trim() !== ''));

  const prisma = new PrismaClient();
  type Action = { name: string; productId: string; skuId: string; decision: 'PUBLISH' | 'SKIP'; reasons: string[]; coverImageFile: string; priceCents: number; storeCode: string };
  const actions: Action[] = [];
  let imageFound = 0, imageMissing = 0, invReady = 0, availReady = 0, planPublish = 0, planSkip = 0, warnings = 0;

  try {
    const stores = await prisma.store.findMany({ select: { id: true, code: true } });
    const storeByCode = new Map(stores.map((s) => [s.code, s.id]));

    for (const r of data) {
      const productId = r[idx('productId')];
      const skuId = r[idx('skuId')];
      const name = r[idx('name')];
      const priceCents = Number(r[idx('priceCents')] || 0);
      const coverImageFile = r[idx('coverImageFile')] || '';
      const storeCode = r[idx('storeCode')] || '';
      const reasons: string[] = [];

      // read-only DB checks
      const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, internalTag: true, isPublished: true } });
      const sku = await prisma.sku.findUnique({ where: { id: skuId }, select: { id: true, priceCents: true, isActive: true, productId: true } });
      const invCount = sku ? await prisma.inventory.count({ where: { skuId } }) : 0;
      const availCount = sku ? await prisma.storeSkuAvailability.count({ where: { skuId, isEnabled: true } }) : 0;

      if (!product) reasons.push('product_not_found');
      if (product && product.internalTag !== IMPORT_TAG) reasons.push('not_import_batch(seed?)');
      if (product && product.isPublished) reasons.push('already_published');
      if (!sku) reasons.push('sku_not_found');
      if (sku && sku.productId !== productId) reasons.push('sku_product_mismatch');
      if (sku && priceCents <= 0) reasons.push('price_not_set');
      if (sku && sku.priceCents <= 0) reasons.push('db_sku_price_zero');
      if (sku && !sku.isActive) reasons.push('sku_inactive');

      // image asset presence
      const fname = coverImageFile.replace(/^assets\/products\//, '');
      const assetOk = fname && fs.existsSync(path.join(assetsDir, fname));
      if (assetOk) imageFound++; else { imageMissing++; reasons.push('image_asset_missing'); }

      // inventory / availability PLAN readiness (we will CREATE them in apply; plan requires a valid store)
      const storeId = storeByCode.get(storeCode);
      if (!storeId) reasons.push('store_code_not_found');
      else { invReady++; availReady++; }

      const decision: 'PUBLISH' | 'SKIP' = reasons.length === 0 ? 'PUBLISH' : 'SKIP';
      if (decision === 'PUBLISH') planPublish++; else planSkip++;
      warnings += reasons.length;
      actions.push({ name, productId, skuId, decision, reasons, coverImageFile, priceCents, storeCode });
    }

    const summary = {
      mode, input_csv: csvPath,
      first_batch_safe_count: data.length,
      hold_count_note: '见 FIRST_BATCH_HOLD_CANDIDATES.csv（本脚本只处理 SAFE 输入）',
      image_path_found_count: imageFound,
      image_path_missing_count: imageMissing,
      inventory_plan_ready_count: invReady,
      store_availability_plan_ready_count: availReady,
      planned_publish_count: planPublish,
      planned_skip_count: planSkip,
      warnings_count: warnings,
      apply_order: ['set Product.coverImageUrl', 'create Inventory', 'create StoreSkuAvailability', 'set Product.isPublished=true'],
    };
    console.log(`publish-first-batch: ${mode.toUpperCase()}`);
    console.log(JSON.stringify(summary, null, 2));
    for (const a of actions) console.log(`  ${a.decision}  ${a.name}  ${a.priceCents}c  ${a.coverImageFile}  ${a.reasons.join('|') || 'ready'}`);

    if (outDir) {
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(`${outDir}/DRY_RUN_SUMMARY.json`, JSON.stringify({ summary, actions }, null, 2));
    }

    if (mode === 'dry-run') { console.log('当前为 dry-run，未写入数据库。'); return; }

    // ---- APPLY（下一阶段；本阶段不会进入）----
    for (const a of actions) {
      if (a.decision !== 'PUBLISH') continue;
      const storeId = storeByCode.get(a.storeCode)!;
      // Phase 2.47A-23：发布前硬保护，命中则跳过。
      const guardTarget = await prisma.product.findUnique({
        where: { id: a.productId },
        select: { id: true, category: true, internalTag: true, coverImageUrl: true, internalNote: true, skus: { select: { priceCents: true, isActive: true } } }
      });
      const guardBlocks = guardTarget
        ? evaluateProductPublishable({ ...guardTarget, coverImageUrl: a.coverImageFile ?? guardTarget.coverImageUrl })
        : [{ code: 'PRODUCT_NOT_FOUND', message: 'not found' }];
      if (guardBlocks.length > 0) {
        console.log('GUARD 跳过发布：', a.productId, guardBlocks.map((b) => b.code).join(','));
        continue;
      }
      await prisma.$transaction(async (tx) => {
        await tx.product.update({ where: { id: a.productId }, data: { coverImageUrl: a.coverImageFile } });
        await tx.inventory.create({ data: { storeId, skuId: a.skuId, physicalStock: 20, availableStock: 20, reservedStock: 0, damagedStock: 0, safeStock: 5 } });
        await tx.storeSkuAvailability.create({ data: { storeId, skuId: a.skuId, isEnabled: true } });
        await tx.product.update({ where: { id: a.productId }, data: { isPublished: true } });
      });
    }
    console.log('first-batch publish apply 完成：', { published: planPublish });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
