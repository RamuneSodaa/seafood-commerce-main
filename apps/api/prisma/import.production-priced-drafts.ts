import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import { PrismaClient } from '@prisma/client';

const EXPECTED_CSV_SHA256 =
  'bbf69c74adbaf57b7420f394e25ca7e52bf465324c1287bf9e6dfd80e1c9da2d';

const EXPECTED_COUNT = 14;
const BATCH = 'production_priced_drafts_20260721';

const LOCKED_NAMES = new Set([
  '干贝瑶柱',
  '海味汤料组合',
  '精选花胶筒',
  '鳕鱼胶',
  '红参',
  '红参须',
  '红参片',
]);

const args = process.argv.slice(2);

function has(flag: string): boolean {
  return args.includes(flag);
}

function value(flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

const isApply = has('--apply');
const confirmed = has('--confirm-production-priced-draft-import');

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];

    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function sha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

function stableSkuCode(index: number, name: string, priceCents: number): string {
  const digest = createHash('sha256')
    .update(`${name}|${priceCents}`)
    .digest('hex')
    .slice(0, 10)
    .toUpperCase();

  return `PPD-20260721-${String(index + 1).padStart(3, '0')}-${digest}`;
}

async function main() {
  const csvPath = value('--csv');

  if (!csvPath || !fs.existsSync(csvPath)) {
    throw new Error('缺少有效 --csv 路径');
  }

  if (isApply && !confirmed) {
    throw new Error(
      'APPLY 必须同时传入 --apply 和 --confirm-production-priced-draft-import',
    );
  }

  const raw = fs.readFileSync(csvPath);
  const actualSha = sha256(raw);

  if (actualSha !== EXPECTED_CSV_SHA256) {
    throw new Error(
      `SAFETY_STOP: CSV SHA256 不匹配。expected=${EXPECTED_CSV_SHA256}, actual=${actualSha}`,
    );
  }

  const grid = parseCsv(raw.toString('utf8').replace(/^\uFEFF/, ''));
  const header = grid[0];

  const indexOf = (name: string) => {
    const index = header.indexOf(name);
    if (index < 0) {
      throw new Error(`缺少 CSV 列：${name}`);
    }
    return index;
  };

  const I = {
    name: indexOf('商品名'),
    category: indexOf('一级分类'),
    priceYuan: indexOf('价格元'),
    priceCents: indexOf('价格分'),
    originalName: indexOf('原始名称'),
    imageStatus: indexOf('当前图片状态'),
    historicalBucket: indexOf('历史审核桶'),
    productionPlan: indexOf('生产计划'),
  };

  const rows = grid
    .slice(1)
    .filter((row) => row.some((cell) => (cell || '').trim() !== ''));

  if (rows.length !== EXPECTED_COUNT) {
    throw new Error(
      `SAFETY_STOP: 候选数量应为 ${EXPECTED_COUNT}，实际 ${rows.length}`,
    );
  }

  const candidates = rows.map((row, index) => {
    const name = (row[I.name] || '').trim();
    const category = (row[I.category] || '').trim();
    const priceCents = Number((row[I.priceCents] || '').trim());
    const productionPlan = (row[I.productionPlan] || '').trim();

    if (!name) {
      throw new Error(`SAFETY_STOP: 第 ${index + 1} 行商品名为空`);
    }

    if (!Number.isInteger(priceCents) || priceCents <= 0) {
      throw new Error(`SAFETY_STOP: ${name} 的价格分非法`);
    }

    if (LOCKED_NAMES.has(name)) {
      throw new Error(`SAFETY_STOP: 锁定商品进入候选：${name}`);
    }

    if (productionPlan !== 'DRAFT_ONLY_NO_INVENTORY_NO_AVAILABILITY') {
      throw new Error(`SAFETY_STOP: ${name} 的生产计划不符合安全约束`);
    }

    return {
      name,
      category,
      priceCents,
      priceYuan: (row[I.priceYuan] || '').trim(),
      originalName: (row[I.originalName] || '').trim(),
      imageStatus: (row[I.imageStatus] || '').trim(),
      historicalBucket: (row[I.historicalBucket] || '').trim(),
      skuCode: stableSkuCode(index, name, priceCents),
    };
  });

  const names = candidates.map((item) => item.name);
  const codes = candidates.map((item) => item.skuCode);

  if (new Set(names).size !== names.length) {
    throw new Error('SAFETY_STOP: 候选商品名存在重复');
  }

  if (new Set(codes).size !== codes.length) {
    throw new Error('SAFETY_STOP: SKU code 发生碰撞');
  }

  console.log(`production-priced-drafts: ${isApply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`CSV_SHA256=${actualSha}`);
  console.log(`CANDIDATE_COUNT=${candidates.length}`);

  for (const [index, item] of candidates.entries()) {
    console.log(
      `${String(index + 1).padStart(2, '0')}. ${item.name} | ${item.category} | ¥${item.priceYuan} | ${item.skuCode}`,
    );
  }

  if (!isApply) {
    console.log('DATABASE_CONNECTION=0');
    console.log('DATABASE_WRITE=0');
    console.log('DRY_RUN_PASS=true');
    return;
  }

  if (process.env.NODE_ENV !== 'production') {
    throw new Error('SAFETY_STOP: APPLY 只允许 NODE_ENV=production');
  }

  const prisma = new PrismaClient();

  try {
    const before = await Promise.all([
      prisma.product.count(),
      prisma.sku.count(),
      prisma.inventory.count(),
      prisma.storeSkuAvailability.count(),
    ]);

    console.log(`PRODUCT_COUNT_BEFORE=${before[0]}`);
    console.log(`SKU_COUNT_BEFORE=${before[1]}`);
    console.log(`INVENTORY_COUNT_BEFORE=${before[2]}`);
    console.log(`AVAILABILITY_COUNT_BEFORE=${before[3]}`);

    if (before.some((count) => count !== 0)) {
      throw new Error(
        'SAFETY_STOP: 生产商品基线不再是 0/0/0/0，拒绝执行一次性首批导入',
      );
    }

    await prisma.$transaction(async (tx) => {
      const txCounts = await Promise.all([
        tx.product.count(),
        tx.sku.count(),
        tx.inventory.count(),
        tx.storeSkuAvailability.count(),
      ]);

      if (txCounts.some((count) => count !== 0)) {
        throw new Error(
          'SAFETY_STOP: 事务内生产商品基线不是 0/0/0/0',
        );
      }

      for (const item of candidates) {
        const product = await tx.product.create({
          data: {
            name: item.name,
            category: item.category || null,
            isPublished: false,
            isRecommended: false,
            coverImageUrl: null,
            internalTag: BATCH,
            internalNote: JSON.stringify({
              batch: BATCH,
              sourceCsvSha256: EXPECTED_CSV_SHA256,
              originalName: item.originalName,
              historicalBucket: item.historicalBucket,
              historicalImageStatus: item.imageStatus,
              productionState: 'PRICED_DRAFT_REVIEW_REQUIRED',
            }),
          },
        });

        await tx.sku.create({
          data: {
            productId: product.id,
            code: item.skuCode,
            name: '默认规格（待运营确认）',
            priceCents: item.priceCents,
            isActive: false,
          },
        });
      }

      // 所有关键安全验证必须在同一事务内完成。
      // 任一条件失败都会抛错，从而整批自动回滚。
      const [
        productCount,
        skuCount,
        inventoryCount,
        availabilityCount,
        publishedCount,
        activeSkuCount,
        imported,
      ] = await Promise.all([
        tx.product.count(),
        tx.sku.count(),
        tx.inventory.count(),
        tx.storeSkuAvailability.count(),
        tx.product.count({ where: { isPublished: true } }),
        tx.sku.count({ where: { isActive: true } }),
        tx.product.findMany({
          where: { internalTag: BATCH },
          select: {
            name: true,
            isPublished: true,
            skus: {
              select: {
                code: true,
                priceCents: true,
                isActive: true,
              },
            },
          },
          orderBy: { name: 'asc' },
        }),
      ]);

      const unsafe = imported.filter(
        (product) =>
          product.isPublished ||
          product.skus.length !== 1 ||
          product.skus.some(
            (sku) => sku.isActive || sku.priceCents <= 0,
          ),
      );

      if (
        productCount !== EXPECTED_COUNT ||
        skuCount !== EXPECTED_COUNT ||
        inventoryCount !== 0 ||
        availabilityCount !== 0 ||
        publishedCount !== 0 ||
        activeSkuCount !== 0 ||
        imported.length !== EXPECTED_COUNT ||
        unsafe.length !== 0
      ) {
        throw new Error(
          'TRANSACTION_VERIFY_FAILED: Draft 安全状态不符合预期，整批回滚',
        );
      }
    });

    // 提交后的只读确认仅用于输出证据；
    // 真正决定 COMMIT/ROLLBACK 的安全验证已经在事务内部完成。
    const after = await Promise.all([
      prisma.product.count(),
      prisma.sku.count(),
      prisma.inventory.count(),
      prisma.storeSkuAvailability.count(),
      prisma.product.count({ where: { isPublished: true } }),
      prisma.sku.count({ where: { isActive: true } }),
    ]);

    console.log(`PRODUCT_COUNT_AFTER=${after[0]}`);
    console.log(`SKU_COUNT_AFTER=${after[1]}`);
    console.log(`INVENTORY_COUNT_AFTER=${after[2]}`);
    console.log(`AVAILABILITY_COUNT_AFTER=${after[3]}`);
    console.log(`PUBLISHED_COUNT_AFTER=${after[4]}`);
    console.log(`ACTIVE_SKU_COUNT_AFTER=${after[5]}`);

    console.log('IMPORTED_DRAFTS=14');
    console.log('PUBLISHED_COUNT=0');
    console.log('ACTIVE_SKU_COUNT=0');
    console.log('INVENTORY_CREATED=0');
    console.log('AVAILABILITY_CREATED=0');
    console.log('APPLY_PASS=true');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
