/**
 * Phase 2.49G — 现有鲜鱼预订单回填 FreshPreorderDetail（默认 DRY-RUN，安全）
 *
 * 只为 isFreshPreorder=true 的订单（任一 OrderItem 的 Sku.Product.internalTag=fresh_seafood_catalog）
 * 创建 1 条 FreshPreorderDetail；若已存在则跳过（orderId 唯一）。
 *   stage=PENDING_STORE_CONFIRMATION
 *   estimatedTotalCents=Order.totalAmountCents
 *   其余字段留空。
 * 不改 Order/OrderItem/商品/库存；不建 PaymentRecord；不触发支付。
 *
 * 用法：
 *   dry-run：node -r ts-node/register prisma/backfill-fresh-preorder-detail.ts
 *   apply  ：node -r ts-node/register prisma/backfill-fresh-preorder-detail.ts --apply --confirm-fresh-preorder-detail-backfill
 */
import { PrismaClient } from '@prisma/client';

const FRESH_TAG = 'fresh_seafood_catalog';
const argv = process.argv.slice(2);
const has = (f: string) => argv.includes(f);
const mode: 'dry-run' | 'apply' = has('--apply') ? 'apply' : 'dry-run';

async function main() {
  if (mode === 'apply' && !has('--confirm-fresh-preorder-detail-backfill')) {
    throw new Error('apply 必须同时传 --apply 与 --confirm-fresh-preorder-detail-backfill。');
  }

  const prisma = new PrismaClient();
  try {
    const dbn = await prisma.$queryRawUnsafe<any[]>('SELECT current_database() AS db');
    const dbName = dbn?.[0]?.db;
    if (dbName !== 'seafood_phase1_realdev') throw new Error(`仅允许写 seafood_phase1_realdev，当前=${dbName}`);

    // 识别鲜鱼预订单：含 fresh_seafood_catalog 商品的订单
    const freshOrders = await prisma.order.findMany({
      where: { items: { some: { sku: { product: { internalTag: FRESH_TAG } } } } },
      select: { id: true, orderNo: true, totalAmountCents: true }
    });

    const plans: Array<{ orderId: string; orderNo: string; estimatedTotalCents: number; willCreate: boolean }> = [];
    let existing = 0;
    for (const o of freshOrders) {
      const detail = await prisma.freshPreorderDetail.findUnique({ where: { orderId: o.id }, select: { id: true } });
      const willCreate = !detail;
      if (detail) existing++;
      plans.push({ orderId: o.id, orderNo: o.orderNo, estimatedTotalCents: o.totalAmountCents, willCreate });
    }
    const willCreate = plans.filter((p) => p.willCreate).length;

    const summary = {
      mode,
      currentDatabase: dbName,
      freshPreorderOrderCount: freshOrders.length,
      existingDetailCount: existing,
      willCreate,
      dbWrite: mode === 'apply' && willCreate > 0
    };
    console.log('backfill-fresh-preorder-detail:', JSON.stringify(summary, null, 2));
    for (const p of plans) {
      console.log(`  ${p.willCreate ? 'CREATE' : 'SKIP(exists)'}  order=${p.orderNo}  estimatedTotalCents=${p.estimatedTotalCents}`);
    }

    if (mode === 'dry-run') {
      console.log('当前为 dry-run，未写入数据库。');
      return;
    }

    let created = 0;
    for (const p of plans) {
      if (!p.willCreate) continue;
      await prisma.freshPreorderDetail.create({
        data: {
          orderId: p.orderId,
          stage: 'PENDING_STORE_CONFIRMATION',
          estimatedTotalCents: p.estimatedTotalCents
        }
      });
      created++;
    }
    console.log('backfill apply 完成：', { created });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(String(e?.message || e));
  process.exit(1);
});
