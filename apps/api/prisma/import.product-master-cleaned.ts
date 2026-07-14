/**
 * Phase 2.47A-8 — 378 真实商品主表导入器（默认 DRY-RUN，安全）
 *
 * 源数据：PRODUCT_MASTER_CLEANED.csv（378 行真实绿膳荟商品，已清洗审计）
 * 设计原则（本阶段只做 dry-run，不写库）：
 *   - 默认 dry-run，绝不写库；apply 必须同时传 --apply --confirm-product-master-import。
 *   - 全部导入为后台草稿：Product.isPublished = false。
 *   - 价格未定 / 无图 一律不发布（本阶段所有商品都不发布）。
 *   - 价格未定时不臆造价格：SKU.priceCents = 0 占位 且 SKU.isActive = false（双重不可售）。
 *   - 每个商品至少 1 个默认 SKU；SKU code 用稳定可重复算法生成（含行号 + 内容哈希），避免重复导入产生重复 SKU。
 *   - 已有 seed 商品（按 name）若重名 → 跳过，绝不覆盖；已存在 SKU code → 记为 conflict，不覆盖。
 *   - 输出 skip / create / conflict / warning 明细。
 *
 * 用法：
 *   dry-run（本阶段）：
 *     node -r ts-node/register prisma/import.product-master-cleaned.ts --dry-run \
 *       --csv "<abs path to PRODUCT_MASTER_CLEANED.csv>" --out "<abs report dir>"
 *   apply（下一阶段，需显式双旗标，本阶段禁止）：
 *     node -r ts-node/register prisma/import.product-master-cleaned.ts \
 *       --apply --confirm-product-master-import --csv "<...>"
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const BATCH = 'product_master_cleaned_20260626';
const INTERNAL_TAG = BATCH;

const argv = new Set(process.argv.slice(2));
function argVal(flag: string): string | undefined {
  const arr = process.argv.slice(2);
  const i = arr.indexOf(flag);
  return i >= 0 && i + 1 < arr.length ? arr[i + 1] : undefined;
}
const isApply = argv.has('--apply');
const confirmed = argv.has('--confirm-product-master-import');
const mode: 'dry-run' | 'apply' = isApply ? 'apply' : 'dry-run';

// ---- minimal robust CSV parser (handles quoted fields, embedded commas/quotes) ----
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* skip */ }
    else field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function stableHash(s: string): string {
  // djb2
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}
function parsePrice(s: string): number | null {
  const t = (s || '').replace(/[￥¥元,\s]/g, '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
function hasDedicatedImage(imgStatus: string): boolean {
  return imgStatus.startsWith('已有专属图');
}

async function main() {
  const csvPath = argVal('--csv');
  const outDir = argVal('--out');
  if (!csvPath || !fs.existsSync(csvPath)) {
    throw new Error('缺少有效 --csv 路径');
  }
  if (mode === 'apply' && !confirmed) {
    throw new Error('apply 模式必须同时传入 --apply 且 --confirm-product-master-import，默认只允许 dry-run。');
  }

  const raw = fs.readFileSync(csvPath, 'utf-8');
  const all = parseCsv(raw);
  const header = all[0];
  const data = all.slice(1).filter((r) => r.some((c) => (c || '').trim() !== ''));
  const C = (r: string[], i: number) => (i < r.length ? (r[i] || '').trim() : '');

  // 列索引
  const COL = { cat: 0, rawName: 1, name: 2, rawPrice: 3, price: 4, priceStatus: 5,
    isMember: 6, memberPrice: 7, specNum: 8, spec: 9, dupSuspect: 10, indep: 11,
    skuLevel: 12, inApp40: 13, appName: 14, priceNeedChange: 15, imgStatus: 16, note: 17 };

  // 只读读取 realdev 已有商品名 / SKU code（绝不写库）
  const prisma = new PrismaClient();
  let existingNames = new Set<string>();
  let existingSkuCodes = new Set<string>();
  try {
    const ps = await prisma.product.findMany({ select: { name: true } });
    existingNames = new Set(ps.map((p) => p.name));
    const sks = await prisma.sku.findMany({ select: { code: true } });
    existingSkuCodes = new Set(sks.map((s) => s.code));
  } finally {
    await prisma.$disconnect();
  }

  // CSV 内重名统计
  const nameCounts = new Map<string, number>();
  for (const r of data) {
    const n = C(r, COL.name);
    if (n) nameCounts.set(n, (nameCounts.get(n) || 0) + 1);
  }

  type Plan = {
    rowNo: number; action: 'create' | 'skip_existing'; name: string; category: string;
    skuCode: string; priceCents: number; skuActive: boolean; isPublished: boolean;
    priceStatus: string; imageStatus: string; hasImage: boolean; priceConfirmed: boolean;
    publishReady: boolean; member: string; memberPrice: string; spec: string;
    dupName: boolean; suspectDup: boolean; warnings: string[]; conflicts: string[];
  };
  const plans: Plan[] = [];
  const seenCodes = new Set<string>();

  data.forEach((r, idx) => {
    const rowNo = idx + 2; // 1=header
    const name = C(r, COL.name);
    const category = C(r, COL.cat);
    const priceStatus = C(r, COL.priceStatus);
    const imageStatus = C(r, COL.imgStatus);
    const priceConfirmed = priceStatus === '已确认' && (parsePrice(C(r, COL.price)) || 0) > 0;
    const priceVal = parsePrice(C(r, COL.price));
    const priceCents = priceConfirmed && priceVal ? Math.round(priceVal * 100) : 0;
    const hasImage = hasDedicatedImage(imageStatus);
    const publishReady = priceConfirmed && hasImage; // 仅计数；本阶段一律不发布
    const skuActive = priceConfirmed; // 价格未定 → 不可售
    const dupName = (nameCounts.get(name) || 0) > 1;
    const suspectDup = C(r, COL.dupSuspect) === '是';

    // 稳定 SKU code：批次 + 行号 + 内容哈希（含行号确保唯一、含内容保证可复现）
    const skuCode = `PMC-${String(rowNo).padStart(4, '0')}-${stableHash(name + '|' + C(r, COL.spec))}`;

    const warnings: string[] = [];
    const conflicts: string[] = [];
    if (!priceConfirmed) warnings.push(`price_pending(${priceStatus || '空'})`);
    if (!hasImage) warnings.push(`image_missing(${imageStatus || '空'})`);
    if (imageStatus.startsWith('错图')) warnings.push('wrong_image');
    if (dupName) warnings.push('duplicate_name_in_csv');
    if (suspectDup) warnings.push('suspected_duplicate_flag');

    let action: 'create' | 'skip_existing' = 'create';
    if (existingNames.has(name)) {
      action = 'skip_existing';
      conflicts.push('name_exists_in_db(skip,no_overwrite)');
    }
    if (existingSkuCodes.has(skuCode)) conflicts.push('sku_code_exists_in_db');
    if (seenCodes.has(skuCode)) conflicts.push('sku_code_collision_in_batch');
    seenCodes.add(skuCode);

    const internalNote = JSON.stringify({
      batch: BATCH, row: rowNo, original_name: C(r, COL.rawName), category,
      price_status: priceStatus, price_raw: C(r, COL.price), image_status: imageStatus,
      member: C(r, COL.isMember), member_price: C(r, COL.memberPrice), spec: C(r, COL.spec),
      suspected_duplicate: suspectDup, in_app40: C(r, COL.inApp40),
    });
    void internalNote; // dry-run 不写库；apply 时用于 Product.internalNote

    plans.push({ rowNo, action, name, category, skuCode, priceCents, skuActive,
      isPublished: false, priceStatus, imageStatus, hasImage, priceConfirmed, publishReady,
      member: C(r, COL.isMember), memberPrice: C(r, COL.memberPrice), spec: C(r, COL.spec),
      dupName, suspectDup, warnings, conflicts });
  });

  const creates = plans.filter((p) => p.action === 'create');
  const skips = plans.filter((p) => p.action === 'skip_existing');
  const catDist: Record<string, number> = {};
  for (const p of creates) catDist[p.category] = (catDist[p.category] || 0) + 1;

  const summary = {
    mode, batch: BATCH, csv: csvPath, csv_rows: data.length,
    planned_products_create_count: creates.length,
    planned_skus_create_count: creates.length, // 每商品 1 个默认 SKU
    skip_existing_count: skips.length,
    conflict_count: plans.filter((p) => p.conflicts.length > 0).length,
    duplicate_name_count: creates.filter((p) => p.dupName).length,
    price_pending_count: plans.filter((p) => !p.priceConfirmed).length,
    image_missing_count: plans.filter((p) => !p.hasImage).length,
    publish_ready_count: plans.filter((p) => p.publishReady).length,
    draft_only_count: creates.length, // 本阶段全部草稿
    warnings_count: plans.reduce((a, p) => a + p.warnings.length, 0),
    rows_with_warnings: plans.filter((p) => p.warnings.length > 0).length,
    member_product_count: plans.filter((p) => p.member === '是').length,
    test_pollution_count: plans.filter((p) => /integration|demo|salmon|^sku$|test/i.test(p.name)).length,
    category_distribution: catDist,
    existing_db_products: existingNames.size,
    existing_db_sku_codes: existingSkuCodes.size,
  };

  console.log(`product-master importer: ${mode.toUpperCase()}`);
  console.log(JSON.stringify(summary, null, 2));

  if (outDir) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(`${outDir}/DRY_RUN_SUMMARY.json`, JSON.stringify(summary, null, 2));
    const esc = (s: any) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const previewHdr = 'rowNo,action,name,category,skuCode,priceCents,skuActive,isPublished,priceStatus,imageStatus,publishReady,warnings\n';
    const previewRows = creates.slice(0, 100).map((p) =>
      [p.rowNo, p.action, esc(p.name), esc(p.category), p.skuCode, p.priceCents, p.skuActive,
       p.isPublished, esc(p.priceStatus), esc(p.imageStatus), p.publishReady, esc(p.warnings.join('|'))].join(',')).join('\n');
    fs.writeFileSync(`${outDir}/DRY_RUN_CREATE_PREVIEW.csv`, previewHdr + previewRows + '\n');
    const warnHdr = 'rowNo,name,warnings\n';
    const warnRows = plans.filter((p) => p.warnings.length).map((p) =>
      [p.rowNo, esc(p.name), esc(p.warnings.join('|'))].join(',')).join('\n');
    fs.writeFileSync(`${outDir}/DRY_RUN_WARNINGS.csv`, warnHdr + warnRows + '\n');
    const confHdr = 'rowNo,name,skuCode,conflicts\n';
    const confRows = plans.filter((p) => p.conflicts.length).map((p) =>
      [p.rowNo, esc(p.name), p.skuCode, esc(p.conflicts.join('|'))].join(',')).join('\n');
    fs.writeFileSync(`${outDir}/EXISTING_PRODUCT_CONFLICTS.csv`, confHdr + confRows + '\n');
    console.log(`reports written to: ${outDir}`);
  }

  if (mode === 'dry-run') {
    console.log('当前为 dry-run，未写入数据库。');
    return;
  }

  // ---- APPLY（下一阶段；本阶段不会进入，因为不传 --apply） ----
  const db = new PrismaClient();
  let createdProducts = 0, createdSkus = 0;
  try {
    for (const p of creates) {
      const row = data[p.rowNo - 2];
      const internalNote = JSON.stringify({
        batch: BATCH, row: p.rowNo, original_name: C(row, COL.rawName), category: p.category,
        price_status: p.priceStatus, price_raw: C(row, COL.price), image_status: p.imageStatus,
        member: p.member, member_price: p.memberPrice, spec: p.spec, suspected_duplicate: p.suspectDup,
      });
      const product = await db.product.create({
        data: {
          name: p.name, category: p.category || null, sortOrder: 0, isRecommended: false,
          isPublished: false, supportsPickup: true, supportsShipping: true,
          internalTag: INTERNAL_TAG, internalNote,
        },
      });
      createdProducts++;
      await db.sku.create({
        data: {
          productId: product.id, code: p.skuCode,
          name: p.spec || '默认规格', priceCents: p.priceCents, isActive: p.skuActive,
        },
      });
      createdSkus++;
    }
    console.log('product-master apply 完成：', { createdProducts, createdSkus });
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
