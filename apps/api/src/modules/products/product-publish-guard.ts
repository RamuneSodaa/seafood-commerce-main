/**
 * Phase 2.47A-23：1 元占位 / 草稿商品「防误发布」硬保护。
 *
 * 纯函数，不读 DB、不写 DB。在任何把 Product.isPublished 置为 true 的入口调用，
 * 阻止价格占位 / 缺图 / 零价 / 无 active SKU / 鲜鱼 / legacy seed3 等商品被误发布。
 *
 * 只在「发布」动作上生效，不改变 /products 查询逻辑，不影响鲜鱼 channel=fresh 展示。
 */

// Phase 2.47A-20 软下架的 legacy unwanted seed3（精确 productId，禁止恢复发布）。
export const LEGACY_UNWANTED_SEED3_IDS: ReadonlySet<string> = new Set([
  'cmr08aiak00009kebnos85rj6', // 精选花胶筒
  'cmr08aias00059keb0d76pbkm', // 干贝瑶柱
  'cmr08aiav000a9kebjvlbe7ok'  // 海味汤料组合
]);

// 鲜鱼目录类目 + 内部标签（鲜鱼走 channel=fresh 展示，绝不走普通干货发布）。
export const FRESH_SEAFOOD_CATEGORIES: ReadonlySet<string> = new Set([
  '野生海鱼', '鲜虾贝蚝', '石斑贵价鱼', '杂鱼/其它', '章鱼鱿鱼'
]);
export const FRESH_SEAFOOD_TAG = 'fresh_seafood_catalog';

export type PublishGuardSku = { priceCents: number; isActive: boolean };
export type PublishGuardProduct = {
  id: string;
  category?: string | null;
  internalTag?: string | null;
  coverImageUrl?: string | null;
  internalNote?: string | null;
  skus: PublishGuardSku[];
};

export type PublishBlock = { code: string; message: string };

function parseNote(raw?: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * 返回所有阻止发布的原因（空数组=可发布）。不抛错，便于脚本/测试批量评估。
 */
export function evaluateProductPublishable(product: PublishGuardProduct): PublishBlock[] {
  const blocks: PublishBlock[] = [];
  const note = parseNote(product.internalNote);
  const skus = product.skus || [];
  const activeSkus = skus.filter((s) => s.isActive);

  // 1) legacy unwanted seed3 禁止恢复发布
  if (LEGACY_UNWANTED_SEED3_IDS.has(product.id)) {
    blocks.push({ code: 'BLOCKED_LEGACY_UNWANTED_SEED3', message: '该商品为已确认不要的 legacy seed3，禁止恢复发布。' });
  }

  // 2) 鲜鱼不能走普通干货发布
  if (FRESH_SEAFOOD_CATEGORIES.has(product.category || '') || product.internalTag === FRESH_SEAFOOD_TAG) {
    blocks.push({ code: 'BLOCKED_FRESH_SEAFOOD_CANNOT_PUBLISH_AS_DRY', message: '鲜鱼目录商品走 channel=fresh 展示，禁止作为普通干货发布。' });
  }

  // 3) 价格占位标记
  if (note.pricePlaceholder === true) {
    blocks.push({ code: 'BLOCKED_PRICE_PLACEHOLDER', message: '该商品为 1 元价格占位（internalNote.pricePlaceholder=true），禁止发布。' });
  }
  if (note.doNotPublishUntilRealPrice === true) {
    blocks.push({ code: 'BLOCKED_DO_NOT_PUBLISH_UNTIL_REAL_PRICE', message: '该商品标记 doNotPublishUntilRealPrice=true，必须先写入真实价格。' });
  }
  if (typeof note.placeholderPhase === 'string' && note.placeholderPhase.startsWith('phase2_47a22')) {
    blocks.push({ code: 'BLOCKED_PRICE_PLACEHOLDER', message: 'placeholderPhase=phase2_47a22 占位商品，禁止发布。' });
  }

  // 3b) 生产有价 Draft：在运营复核完成前一律禁止普通发布。
  // 即使后续误启用 SKU / 补图，也必须先由受控流程解除该 productionState。
  if (note.productionState === 'PRICED_DRAFT_REVIEW_REQUIRED') {
    blocks.push({
      code: 'BLOCKED_PRICED_DRAFT_REVIEW_REQUIRED',
      message: '该商品仍处于生产有价 Draft 运营复核状态，禁止直接发布。'
    });
  }

  // 4) 无 active SKU
  if (activeSkus.length === 0) {
    blocks.push({ code: 'BLOCKED_NO_ACTIVE_SKU', message: '没有 active SKU，禁止发布。' });
  }

  // 5) 零价 / 非正价
  if (activeSkus.some((s) => !(s.priceCents > 0))) {
    blocks.push({ code: 'BLOCKED_ZERO_OR_PLACEHOLDER_PRICE', message: '存在 priceCents<=0 的 active SKU，禁止发布。' });
  }

  // 5b) Phase 2.47A-24 补强：本项目里 1 元(priceCents===100) 一律视为「未知价格占位」，
  // 不论是否带 pricePlaceholder 标记，任一 active SKU 为 100 即禁止发布。
  // 如未来确需销售 1 元商品，另起阶段加白名单，当前一律拦截。
  if (activeSkus.some((s) => s.priceCents === 100)) {
    blocks.push({ code: 'BLOCKED_ONE_YUAN_PLACEHOLDER_PRICE', message: '存在 priceCents=100（1 元占位价）的 active SKU，禁止发布；需先写入真实价格。' });
  }

  // 6) 无封面图
  if (!product.coverImageUrl || !product.coverImageUrl.trim()) {
    blocks.push({ code: 'BLOCKED_NO_COVER_IMAGE', message: '缺少 coverImageUrl，禁止发布。' });
  }

  return blocks;
}

/**
 * 发布硬保护：若不可发布则抛错（错误信息含首个 BLOCKED_* code，便于排查）。
 * @param throwError 在 NestJS 服务里传入 BadRequestException 构造器以保留 HTTP 语义；
 *                   脚本里可不传，默认抛普通 Error。
 */
export function assertProductCanBePublished(
  product: PublishGuardProduct,
  throwError?: (msg: string) => Error
): void {
  const blocks = evaluateProductPublishable(product);
  if (blocks.length > 0) {
    const msg = `${blocks[0].code}: ${blocks.map((b) => b.code).join(',')} | ${blocks[0].message}`;
    throw throwError ? throwError(msg) : new Error(msg);
  }
}
