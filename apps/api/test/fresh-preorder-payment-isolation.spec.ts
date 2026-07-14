/**
 * Phase 2.48J：鲜鱼预订 / 支付隔离回归测试。
 *
 * 固化 Phase 2.48I 审计结论：鲜鱼(fresh_seafood_catalog) 不能进入普通可支付链路。
 * 全部使用 mock，不连数据库、不下真实订单、不调用真实微信支付。
 *
 * 历史：2.48J 首次加入时 "createMiniappPayment 拒绝含 fresh 的订单" 为红灯，暴露了一个真实 bug
 * （createMiniappPayment 仅依赖未被填充的 order.isFreshPreorder）。Phase 2.48K 已修复为真实内容判定，
 * 该用例现已转绿；本 spec 作为长期回归守卫，防止再次回归。
 */
import { BadRequestException } from '@nestjs/common';
import { UserRole } from '../src/common/roles/role.enum';
import { OrderWorkflowService } from '../src/modules/orders/order-workflow.service';
import { OrderPricingService } from '../src/modules/pricing/order-pricing.service';
import {
  evaluateProductPublishable,
  type PublishGuardProduct
} from '../src/modules/products/product-publish-guard';

const FRESH_TAG = 'fresh_seafood_catalog';

// ---------- 1) publish guard（纯函数） ----------
describe('product-publish-guard', () => {
  const base: PublishGuardProduct = {
    id: 'p-ok', category: '陈皮', internalTag: null, coverImageUrl: 'assets/x.jpg',
    internalNote: '{}', skus: [{ priceCents: 500, isActive: true }]
  };
  const codes = (p: PublishGuardProduct) => evaluateProductPublishable(p).map((b) => b.code);

  test('合规干货商品通过（无 block）', () => {
    expect(evaluateProductPublishable(base)).toEqual([]);
  });
  test('fresh 商品 → BLOCKED_FRESH_SEAFOOD_CANNOT_PUBLISH_AS_DRY', () => {
    expect(codes({ ...base, category: '野生海鱼' })).toContain('BLOCKED_FRESH_SEAFOOD_CANNOT_PUBLISH_AS_DRY');
    expect(codes({ ...base, internalTag: FRESH_TAG })).toContain('BLOCKED_FRESH_SEAFOOD_CANNOT_PUBLISH_AS_DRY');
  });
  test('1 元占位价 → BLOCKED_ONE_YUAN_PLACEHOLDER_PRICE（无需标记）', () => {
    expect(codes({ ...base, skus: [{ priceCents: 100, isActive: true }] }))
      .toContain('BLOCKED_ONE_YUAN_PLACEHOLDER_PRICE');
  });
  test('doNotPublishUntilRealPrice=true → BLOCKED_DO_NOT_PUBLISH_UNTIL_REAL_PRICE', () => {
    expect(codes({ ...base, internalNote: JSON.stringify({ doNotPublishUntilRealPrice: true }) }))
      .toContain('BLOCKED_DO_NOT_PUBLISH_UNTIL_REAL_PRICE');
  });
  test('legacy seed3 → BLOCKED_LEGACY_UNWANTED_SEED3', () => {
    expect(codes({ ...base, id: 'cmr08aiak00009kebnos85rj6' })).toContain('BLOCKED_LEGACY_UNWANTED_SEED3');
  });
  test('零价 → BLOCKED_ZERO_OR_PLACEHOLDER_PRICE；无图 → BLOCKED_NO_COVER_IMAGE', () => {
    expect(codes({ ...base, skus: [{ priceCents: 0, isActive: true }] })).toContain('BLOCKED_ZERO_OR_PLACEHOLDER_PRICE');
    expect(codes({ ...base, coverImageUrl: '' })).toContain('BLOCKED_NO_COVER_IMAGE');
  });
});

// ---------- 2) 普通建单报价：fresh 拒绝、dry 通过 ----------
describe('buildOrderQuote (via previewOrderQuote)', () => {
  function repoFor(product: { isPublished: boolean; internalTag?: string | null; supportsPickup?: boolean }) {
    const sku = {
      id: 's1', priceCents: 500, isActive: true, memberPrices: [],
      product: { isPublished: product.isPublished, internalTag: product.internalTag ?? null,
        supportsPickup: product.supportsPickup ?? true, supportsShipping: true }
    };
    return {
      tx: async (cb: any) => cb({}),
      findStore: async () => ({ id: 'store1', isActive: true }),
      findSkus: async () => [sku],
      findAvailability: async () => [{ skuId: 's1' }]
    } as any;
  }
  const dto = { storeId: 'store1', fulfillmentType: 'STORE_PICKUP', items: [{ skuId: 's1', quantity: 1 }] } as any;

  test('dry（isPublished=true）→ 通过并返回报价', async () => {
    const svc = new OrderWorkflowService(repoFor({ isPublished: true }), new OrderPricingService());
    const quote = await svc.previewOrderQuote(dto, 'cust1');
    expect(quote).toHaveProperty('totalAmountCents');
  });
  test('fresh（isPublished=false）→ 拒绝 Product is not published', async () => {
    const svc = new OrderWorkflowService(repoFor({ isPublished: false, internalTag: FRESH_TAG }), new OrderPricingService());
    await expect(svc.previewOrderQuote(dto, 'cust1')).rejects.toThrow('Product is not published');
  });
});

// ---------- 3) createFreshPreorder：fresh-only ok、dry/mixed 拒绝 ----------
describe('createFreshPreorder', () => {
  function freshRepo(skuDefs: Array<{ id: string; tag: string; price?: number; active?: boolean }>) {
    const skus = skuDefs.map((s) => ({ id: s.id, isActive: s.active ?? true, priceCents: s.price ?? 500,
      product: { internalTag: s.tag } }));
    const tx = {
      store: { findUnique: async () => ({ id: 'store1' }) },
      orderNote: { create: async () => ({}) },
      cartItem: { deleteMany: async () => ({}) }
    };
    return {
      tx: async (cb: any) => cb(tx),
      findStore: async () => ({ id: 'store1', isActive: true }),
      findSkus: async () => skus,
      findAvailability: async () => skuDefs.map((s) => ({ skuId: s.id })),
      getInventoriesForOrder: async () => skuDefs.map((s) => ({ skuId: s.id, availableStock: 99 })),
      createOrder: async () => ({ id: 'fp1', orderNo: 'FP-1', status: 'PENDING_PAYMENT', totalAmountCents: 500, pickupRecord: { pickupCode: '123456' } }),
      insertOrderStatusLog: async () => ({})
    } as any;
  }

  test('fresh-only → 成功且 paymentRequired=false', async () => {
    const repo = freshRepo([{ id: 'f1', tag: FRESH_TAG }]);
    const svc = new OrderWorkflowService(repo, new OrderPricingService());
    const r = await svc.createFreshPreorder('cust1', { storeId: 'store1', items: [{ skuId: 'f1', quantity: 1 }] });
    expect(r.paymentRequired).toBe(false);
    expect(r.isFreshPreorder).toBe(true);
  });
  test('dry 商品 → 拒绝（仅限新鲜渔产预订）', async () => {
    const repo = freshRepo([{ id: 'd1', tag: 'product_master_cleaned_20260626' }]);
    const svc = new OrderWorkflowService(repo, new OrderPricingService());
    await expect(svc.createFreshPreorder('cust1', { storeId: 'store1', items: [{ skuId: 'd1', quantity: 1 }] }))
      .rejects.toBeInstanceOf(BadRequestException);
  });
  test('mixed fresh+dry → 拒绝', async () => {
    const repo = freshRepo([{ id: 'f1', tag: FRESH_TAG }, { id: 'd1', tag: 'dry' }]);
    const svc = new OrderWorkflowService(repo, new OrderPricingService());
    await expect(svc.createFreshPreorder('cust1', { storeId: 'store1', items: [{ skuId: 'f1', quantity: 1 }, { skuId: 'd1', quantity: 1 }] }))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});

// ---------- 4) createMiniappPayment：含 fresh 的订单必须拒绝；dry 订单不被误拦 ----------
describe('createMiniappPayment fresh isolation', () => {
  function payRepo(items: Array<{ internalTag: string }>) {
    const freshCount = items.filter((it) => it.internalTag === 'fresh_seafood_catalog').length;
    return {
      getOrderDetail: async () => ({
        id: 'o1', orderNo: 'SO-1', customerId: 'wechat:openid-1', status: 'PENDING_PAYMENT', totalAmountCents: 5000,
        items: items.map((it) => ({ sku: { product: { internalTag: it.internalTag } } })), statusLogs: []
      }),
      // 模拟 isFreshPreorderOrder(tx, orderId) 的真实内容判定（tx.orderItem.count 过滤 fresh 标签）。
      tx: async (cb: any) => cb({ orderItem: { count: async () => freshCount } })
    } as any;
  }
  const actor = { role: UserRole.CUSTOMER, userId: 'wechat:openid-1' } as any;

  test('dry 订单 → 不被 fresh guard 拦截（正常发起支付）', async () => {
    const pay: any = { createMiniappPayment: jest.fn().mockResolvedValue({ launchParams: { package: 'prepay_id=x' } }) };
    const svc = new OrderWorkflowService(payRepo([{ internalTag: 'dry' }]), new OrderPricingService(), undefined, undefined, undefined, undefined, pay);
    const r = await svc.createMiniappPayment('o1', actor);
    expect(pay.createMiniappPayment).toHaveBeenCalled();
    expect(r).toHaveProperty('launchParams');
  });

  // 要求：含 fresh 的订单不得发起微信支付。Phase 2.48K-fix 后 createMiniappPayment 用真实内容判定拦截 → 通过。
  test('含 fresh 的订单 → 必须拒绝，且不调用微信支付（2.48K 修复后转绿）', async () => {
    const pay: any = { createMiniappPayment: jest.fn().mockResolvedValue({ launchParams: { package: 'prepay_id=x' } }) };
    const svc = new OrderWorkflowService(payRepo([{ internalTag: FRESH_TAG }]), new OrderPricingService(), undefined, undefined, undefined, undefined, pay);
    await expect(svc.createMiniappPayment('o1', actor)).rejects.toThrow('不支持在线支付');
    expect(pay.createMiniappPayment).not.toHaveBeenCalled();
  });
});
