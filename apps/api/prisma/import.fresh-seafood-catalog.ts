/**
 * Phase 2.48B — 新鲜渔产目录导入器（默认 DRY-RUN，create-only，安全）
 *
 * 输入：FRESH_SEAFOOD_PRODUCT_MASTER_DRYRUN.csv（列：name,businessLine,category,priceMode,priceLabel,isPublished,skuActive,inventoryMode,suggestedDisplayTag,notes）
 *
 * 行为（短期过渡，不改 schema）：
 *   - 每行创建 1 个 Product 草稿 + 1 个默认 Sku 占位。
 *   - Product：isPublished=false, supportsPickup=true, supportsShipping=false, coverImageUrl=null,
 *     internalTag='fresh_seafood_catalog', internalNote=JSON(businessLine/priceMode/priceLabel/saleMode/...)。
 *   - Sku：code=FSC-<行号>-<hash>, name=商品名, priceCents=0, isActive=false。
 *   - 不创建 Inventory / StoreSkuAvailability；不发布；不 update/upsert/delete 任何已有数据。
 *
 * 安全：默认 dry-run；apply 必须 --apply --confirm-fresh-seafood-import；apply 前确认 DB 名为 seafood_phase1_realdev。
 *   create-only；不 drop/truncate/db push/migrate。
 *
 * 用法：
 *   dry-run：node -r ts-node/register prisma/import.fresh-seafood-catalog.ts --dry-run --csv <CSV> [--out <dir>]
 *   apply  ：node -r ts-node/register prisma/import.fresh-seafood-catalog.ts --apply --confirm-fresh-seafood-import --csv <CSV>
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const IMPORT_TAG = 'fresh_seafood_catalog';
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
function stableHash(s: string): string { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(16).padStart(8, '0'); }

async function main() {
  const csvPath = val('--csv'); const outDir = val('--out');
  if (!csvPath || !fs.existsSync(csvPath)) throw new Error('缺少有效 --csv');
  if (mode === 'apply' && !has('--confirm-fresh-seafood-import'))
    throw new Error('apply 必须同时传 --apply 与 --confirm-fresh-seafood-import。');

  const grid = parseCsv(fs.readFileSync(csvPath, 'utf-8'));
  const header = grid[0]; const ix = (n: string) => header.indexOf(n);
  const data = grid.slice(1).filter((r) => r.some((c) => (c || '').trim() !== ''));

  const prisma = new PrismaClient();
  try {
    // apply 前确认目标库
    const dbn = await prisma.$queryRawUnsafe<any[]>('SELECT current_database() AS db');
    const dbName = dbn?.[0]?.db;
    if (mode === 'apply' && dbName !== 'seafood_phase1_realdev')
      throw new Error(`apply 仅允许写 seafood_phase1_realdev，当前库=${dbName}，已停止。`);

    const existingSkuCodes = new Set((await prisma.sku.findMany({ select: { code: true } })).map((s) => s.code));

    type Plan = { rowNo: number; name: string; category: string; skuCode: string; conflict: string[] };
    const plans: Plan[] = []; const seen = new Set<string>();
    data.forEach((r, i) => {
      const rowNo = i + 2;
      const name = (r[ix('name')] || '').trim();
      const category = (r[ix('category')] || '').trim();
      const skuCode = `FSC-${String(rowNo).padStart(4, '0')}-${stableHash(name)}`;
      const conflict: string[] = [];
      if (!name) conflict.push('empty_name');
      if (existingSkuCodes.has(skuCode)) conflict.push('sku_code_exists');
      if (seen.has(skuCode)) conflict.push('sku_code_dup_in_batch');
      seen.add(skuCode);
      plans.push({ rowNo, name, category, skuCode, conflict });
    });

    const summary = {
      mode, csv: csvPath, csv_rows: data.length,
      planned_products_create_count: plans.length,
      planned_skus_create_count: plans.length,
      conflict_count: plans.filter((p) => p.conflict.length).length,
      existing_product_conflict_count: 0,   // create-only，按 name 不查重（业务允许与干货同字）
      existing_sku_code_conflict_count: plans.filter((p) => p.conflict.includes('sku_code_exists')).length,
      planned_publish_count: 0,
      planned_inventory_create_count: 0,
      planned_store_availability_create_count: 0,
      warnings_count: plans.reduce((a, p) => a + p.conflict.length, 0),
      db: dbName,
    };
    console.log(`fresh-seafood import: ${mode.toUpperCase()}`);
    console.log(JSON.stringify(summary, null, 2));
    if (outDir) { fs.mkdirSync(outDir, { recursive: true }); fs.writeFileSync(`${outDir}/DRY_RUN_RESULT.json`, JSON.stringify({ summary, plans }, null, 2)); }

    if (mode === 'dry-run') { console.log('当前为 dry-run，未写入数据库。'); return; }
    if (summary.conflict_count > 0) throw new Error('存在冲突，停止 apply。');

    let products = 0, skus = 0;
    for (const p of plans) {
      const internalNote = JSON.stringify({
        businessLine: 'FRESH_SEAFOOD', priceMode: 'MARKET_PRICE', priceLabel: '时价',
        saleMode: 'DAILY_STOCK', inventoryMode: 'DAILY_STOCK', suggestedDisplayTag: '每日到货/时价',
        source: 'phase2_48a_fresh_seafood_dryrun', row: p.rowNo,
        note: '新鲜渔产草稿，需每日定价、称重、库存确认',
      });
      const product = await prisma.product.create({
        data: {
          name: p.name, description: null, coverImageUrl: null, category: p.category || null,
          sortOrder: 0, isRecommended: false, isPublished: false,
          supportsPickup: true, supportsShipping: false,
          internalTag: IMPORT_TAG, internalNote,
        },
      });
      products++;
      await prisma.sku.create({ data: { productId: product.id, code: p.skuCode, name: p.name, priceCents: 0, isActive: false } });
      skus++;
    }
    console.log('fresh-seafood import apply 完成：', { products, skus });
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
