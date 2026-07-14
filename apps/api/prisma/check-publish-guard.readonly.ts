/**
 * Phase 2.47A-23：发布硬保护只读验证脚本（不写 DB）。
 * 运行：cd apps/api && node -r ts-node/register prisma/check-publish-guard.readonly.ts
 */
import { PrismaClient } from '@prisma/client';
import { evaluateProductPublishable } from '../src/modules/products/product-publish-guard';

const FRESH = ['野生海鱼', '鲜虾贝蚝', '石斑贵价鱼', '杂鱼/其它', '章鱼鱿鱼'];
const SEED3 = ['cmr08aiak00009kebnos85rj6', 'cmr08aias00059keb0d76pbkm', 'cmr08aiav000a9kebjvlbe7ok'];
const SELECT = { id: true, category: true, internalTag: true, coverImageUrl: true, internalNote: true, skus: { select: { priceCents: true, isActive: true } } } as const;

async function main() {
  const prisma = new PrismaClient();
  try {
    const db = await prisma.$queryRawUnsafe<{ db: string }[]>('select current_database() as db');
    if (db[0].db !== 'seafood_phase1_realdev') { console.error('ABORT not realdev'); process.exit(3); }

    // 1) 265 占位商品应全部被拒
    const placeholders = await prisma.product.findMany({ where: { internalNote: { contains: 'phase2_47a22' } }, select: SELECT });
    const placeholderRejected = placeholders.filter((p) => evaluateProductPublishable(p).length > 0).length;

    // 2) 已发布 57 重新过 guard 不应被误判失败
    const published = await prisma.product.findMany({ where: { isPublished: true }, select: SELECT });
    const publishedFalseBlocked = published.filter((p) => evaluateProductPublishable(p).length > 0);

    // 3) fresh 34 应被 BLOCKED_FRESH
    const fresh = await prisma.product.findMany({ where: { category: { in: FRESH } }, select: SELECT });
    const freshBlocked = fresh.filter((p) => evaluateProductPublishable(p).some((b) => b.code === 'BLOCKED_FRESH_SEAFOOD_CANNOT_PUBLISH_AS_DRY')).length;

    // 4) seed3 应被 BLOCKED_LEGACY
    const seed3 = await prisma.product.findMany({ where: { id: { in: SEED3 } }, select: SELECT });
    const seed3Blocked = seed3.filter((p) => evaluateProductPublishable(p).some((b) => b.code === 'BLOCKED_LEGACY_UNWANTED_SEED3')).length;

    // 5) 零价（合成，不写库）
    const zeroPrice = evaluateProductPublishable({ id: 'synthetic-zero', category: '陈皮', coverImageUrl: 'assets/x.jpg', internalNote: '{}', skus: [{ priceCents: 0, isActive: true }] });
    // 6) 无图（合成）
    const noImage = evaluateProductPublishable({ id: 'synthetic-noimg', category: '陈皮', coverImageUrl: '', internalNote: '{}', skus: [{ priceCents: 500, isActive: true }] });
    // 6b) Phase 2.47A-24：裸 1 元（priceCents=100，无 pricePlaceholder 标记）必须被拒
    const nakedOneYuan = evaluateProductPublishable({ id: 'synthetic-naked-100', category: '陈皮', coverImageUrl: 'assets/x.jpg', internalNote: '{}', skus: [{ priceCents: 100, isActive: true }] });
    // 对照：合规商品应通过（合成）
    const okSample = evaluateProductPublishable({ id: 'synthetic-ok', category: '陈皮', coverImageUrl: 'assets/x.jpg', internalNote: '{}', skus: [{ priceCents: 500, isActive: true }] });

    const result = {
      placeholder_total: placeholders.length,
      placeholder_rejected: placeholderRejected,
      placeholder_all_rejected: placeholderRejected === placeholders.length,
      published_total: published.length,
      published_false_blocked: publishedFalseBlocked.length,
      published_false_blocked_samples: publishedFalseBlocked.slice(0, 5).map((p) => ({ id: p.id, blocks: evaluateProductPublishable(p).map((b) => b.code) })),
      fresh_total: fresh.length,
      fresh_blocked: freshBlocked,
      seed3_total: seed3.length,
      seed3_blocked: seed3Blocked,
      zero_price_blocked: zeroPrice.some((b) => b.code === 'BLOCKED_ZERO_OR_PLACEHOLDER_PRICE'),
      no_image_blocked: noImage.some((b) => b.code === 'BLOCKED_NO_COVER_IMAGE'),
      naked_one_yuan_blocked: nakedOneYuan.some((b) => b.code === 'BLOCKED_ONE_YUAN_PLACEHOLDER_PRICE'),
      ok_sample_passes: okSample.length === 0
    };
    console.log(JSON.stringify(result, null, 1));
  } finally {
    // no writes performed
  }
}
main().catch((e) => { console.error('ERR', String(e.message).slice(0, 140)); process.exit(1); });
