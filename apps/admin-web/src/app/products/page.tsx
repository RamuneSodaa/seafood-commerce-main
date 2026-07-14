'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AdminAlert, AdminBadge, AdminEmpty, AdminLoadingBlocks, AdminPage, AdminSection } from '../../components/admin-ui';
import { adminApi, type CreateDraftProductPayload, type CreateProductPayload, type ProductRow, type StoreRow, type UpdateProductPayload } from '../../lib/api';
import { formatDateTime, formatMoney } from '../../lib/orders';
import { getProductMerchandisingHint, getProductPriceSummary, getProductStatusMeta } from '../../lib/products';

const EMPTY_CREATE_FORM = {
  name: '',
  description: '',
  coverImageUrl: '',
  supportsPickup: true,
  supportsShipping: true,
  defaultSkuName: '',
  defaultSkuCode: '',
  defaultPriceCents: '',
  initialStoreId: '',
  initialStock: ''
};

// Phase 2.45B：价格未定草稿建档表单。只填商品级字段，无价格/库存/SKU。
const EMPTY_DRAFT_FORM = {
  name: '',
  category: '',
  description: '',
  internalNote: ''
};

const PRICE_PENDING_TAG = 'price_pending';

const EMPTY_EDIT_FORM = {
  name: '',
  description: '',
  coverImageUrl: '',
  supportsPickup: true,
  supportsShipping: true,
  defaultSkuName: '',
  defaultPriceCents: '',
  internalTag: '',
  internalNote: ''
};

function centsToYuanInput(priceCents?: number): string {
  if (!Number.isFinite(priceCents)) return '';
  return ((priceCents || 0) / 100).toFixed(2);
}

function yuanInputToCents(value: string): number {
  const normalized = value.trim().replace(/[￥¥,，\s]/g, '');
  if (!normalized) return Number.NaN;

  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return Number.NaN;
  return Math.round(amount * 100);
}

function isSuspectedTestProduct(product: ProductRow): boolean {
  const text = `${product.name} ${product.description || ''}`.toLowerCase();
  return text.includes('新鲜三文鱼') || text.includes('一期演示商品') || text.includes('demo') || text.includes('test');
}

// Phase 2.39B：后台运营分类（纯前端临时规则，不写 DB，不新增字段）。
// 业务暂不上架：本期明确隐藏、未来可重新发布的 5 个商品。
const BUSINESS_HIDDEN_NAMES = new Set(['海味汤料组合', '干贝瑶柱', '精选花胶筒', '红参', '鳕鱼胶']);

// Phase 2.39C：主规则为 internalTag；名称规则仅作 backfill 之前老数据的兼容 fallback。
// 历史测试 / demo：测试/演示遗留记录（逐条识别，Integration Product 有多条重名）。
function isHistoricalDemoProduct(product: ProductRow): boolean {
  if (product.internalTag === 'historical_demo') return true;
  if (product.internalTag) return false; // 已有其它标签则不靠名称猜
  return product.name === 'Integration Product' || product.name.startsWith('新鲜三文鱼');
}

function isBusinessHiddenProduct(product: ProductRow): boolean {
  if (product.internalTag === 'business_hidden') return true;
  if (product.internalTag) return false;
  return !product.isPublished && BUSINESS_HIDDEN_NAMES.has(product.name);
}

// Phase 2.45B：价格未定草稿（internalTag=price_pending）。
function isPricePendingDraft(product: ProductRow): boolean {
  return product.internalTag === PRICE_PENDING_TAG;
}

type ProductFilterKey = 'published' | 'unpublished' | 'price_pending' | 'demo' | 'all';

function matchesProductFilter(product: ProductRow, filter: ProductFilterKey): boolean {
  if (filter === 'published') return product.isPublished;
  if (filter === 'unpublished') return !product.isPublished;
  if (filter === 'price_pending') return isPricePendingDraft(product);
  if (filter === 'demo') return isHistoricalDemoProduct(product);
  return true;
}

export default function AdminProductsPage() {
  const [data, setData] = useState<ProductRow[]>([]);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  // Phase 2.45B：价格未定草稿建档表单。
  const [draftForm, setDraftForm] = useState(EMPTY_DRAFT_FORM);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  // Phase 2.38C：多 SKU 管理 + 下架
  const [skuDrafts, setSkuDrafts] = useState<Record<string, { name: string; price: string }>>({});
  const [savingSkuId, setSavingSkuId] = useState('');
  const [newSku, setNewSku] = useState({ name: '', price: '' });
  const [addingSku, setAddingSku] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  // Phase 2.39B：商品列表筛选，默认只看已发布（当前运营商品）。
  const [productFilter, setProductFilter] = useState<ProductFilterKey>('published');

  async function load() {
    setLoading(true);
    setError('');

    try {
      const [rows, storeRows] = await Promise.all([adminApi.products(), adminApi.stores()]);
      setData(rows);
      setStores(storeRows);
      setSelectedId((current) => current || rows[0]?.id || '');
      setCreateForm((current) => ({
        ...current,
        initialStoreId: current.initialStoreId || storeRows[0]?.id || ''
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载商品失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const selectedProduct = useMemo(
    () => data.find((item) => item.id === selectedId) ?? data[0] ?? null,
    [data, selectedId]
  );

  useEffect(() => {
    if (!selectedProduct) {
      setEditForm(EMPTY_EDIT_FORM);
      return;
    }

    setEditForm({
      name: selectedProduct.name,
      description: selectedProduct.description?.trim() || '',
      coverImageUrl: selectedProduct.coverImageUrl?.trim() || '',
      supportsPickup: selectedProduct.supportsPickup,
      supportsShipping: selectedProduct.supportsShipping,
      defaultSkuName: selectedProduct.skus[0]?.name || '',
      defaultPriceCents: selectedProduct.skus[0] ? centsToYuanInput(selectedProduct.skus[0].priceCents) : '',
      internalTag: selectedProduct.internalTag || '',
      internalNote: selectedProduct.internalNote || ''
    });

    const drafts: Record<string, { name: string; price: string }> = {};
    for (const sku of selectedProduct.skus) {
      drafts[sku.id] = { name: sku.name, price: centsToYuanInput(sku.priceCents) };
    }
    setSkuDrafts(drafts);
    setNewSku({ name: '', price: '' });
  }, [selectedProduct]);

  const trimmedCreateForm = useMemo(
    () => ({
      name: createForm.name.trim(),
      description: createForm.description.trim(),
      coverImageUrl: createForm.coverImageUrl.trim(),
      defaultSkuName: createForm.defaultSkuName.trim(),
      defaultSkuCode: createForm.defaultSkuCode.trim(),
      defaultPriceCents: yuanInputToCents(createForm.defaultPriceCents),
      initialStoreId: createForm.initialStoreId,
      initialStock: Number(createForm.initialStock),
      supportsPickup: createForm.supportsPickup,
      supportsShipping: createForm.supportsShipping
    }),
    [createForm]
  );

  const createFormMissingFields = useMemo(() => {
    const missing: string[] = [];

    if (!trimmedCreateForm.name) missing.push('商品名称');
    if (!trimmedCreateForm.defaultSkuName) missing.push('默认规格名称');
    if (!trimmedCreateForm.initialStoreId) missing.push('初始门店');
    if (!trimmedCreateForm.supportsPickup && !trimmedCreateForm.supportsShipping) missing.push('至少一种履约方式');
    if (!Number.isFinite(trimmedCreateForm.defaultPriceCents) || trimmedCreateForm.defaultPriceCents < 0) missing.push('价格');
    if (!Number.isFinite(trimmedCreateForm.initialStock) || trimmedCreateForm.initialStock < 0) missing.push('初始库存');

    return missing;
  }, [trimmedCreateForm]);

  const canCreate = createFormMissingFields.length === 0 && !creating && !loading;
  const selectedProductIsSingleSku = (selectedProduct?.skus.length ?? 0) === 1;

  const trimmedEditForm = useMemo(
    () => ({
      name: editForm.name.trim(),
      description: editForm.description.trim(),
      coverImageUrl: editForm.coverImageUrl.trim(),
      supportsPickup: editForm.supportsPickup,
      supportsShipping: editForm.supportsShipping,
      defaultSkuName: editForm.defaultSkuName.trim(),
      defaultPriceCents: yuanInputToCents(editForm.defaultPriceCents)
    }),
    [editForm]
  );

  const editFormMissingFields = useMemo(() => {
    const missing: string[] = [];

    if (!trimmedEditForm.name) missing.push('商品名称');
    if (!trimmedEditForm.supportsPickup && !trimmedEditForm.supportsShipping) missing.push('至少一种履约方式');
    if (selectedProductIsSingleSku) {
      if (!trimmedEditForm.defaultSkuName) missing.push('默认规格名称');
      if (!Number.isFinite(trimmedEditForm.defaultPriceCents) || trimmedEditForm.defaultPriceCents < 0) missing.push('默认规格价格');
    }

    return missing;
  }, [selectedProductIsSingleSku, trimmedEditForm]);

  const canSaveEdit = Boolean(selectedProduct) && editFormMissingFields.length === 0 && !savingEdit;
  const suspectedTestProducts = useMemo(() => data.filter(isSuspectedTestProduct), [data]);

  // Phase 2.39B：分类计数 + 当前筛选下可见商品。
  const productCounts = useMemo(
    () => ({
      published: data.filter((item) => item.isPublished).length,
      unpublished: data.filter((item) => !item.isPublished).length,
      price_pending: data.filter(isPricePendingDraft).length,
      demo: data.filter(isHistoricalDemoProduct).length,
      all: data.length
    }),
    [data]
  );
  const visibleProducts = useMemo(
    () => data.filter((item) => matchesProductFilter(item, productFilter)),
    [data, productFilter]
  );

  async function createProduct() {
    if (!canCreate) {
      setError(`请先补齐商品创建信息：${createFormMissingFields.join('、')}。`);
      return;
    }

    const payload: CreateProductPayload = {
      name: trimmedCreateForm.name,
      description: trimmedCreateForm.description || undefined,
      coverImageUrl: trimmedCreateForm.coverImageUrl || undefined,
      supportsPickup: trimmedCreateForm.supportsPickup,
      supportsShipping: trimmedCreateForm.supportsShipping,
      defaultSkuName: trimmedCreateForm.defaultSkuName,
      defaultSkuCode: trimmedCreateForm.defaultSkuCode || undefined,
      defaultPriceCents: trimmedCreateForm.defaultPriceCents,
      initialStoreId: trimmedCreateForm.initialStoreId,
      initialStock: trimmedCreateForm.initialStock
    };

    try {
      setCreating(true);
      setError('');
      setFeedback('');
      const created = await adminApi.createProduct(payload);
      setFeedback('商品、默认规格与初始库存已创建。');
      setCreateForm({
        ...EMPTY_CREATE_FORM,
        initialStoreId: trimmedCreateForm.initialStoreId
      });
      await load();
      setSelectedId(created.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建商品失败');
    } finally {
      setCreating(false);
    }
  }

  // Phase 2.45B：建价格未定草稿。只提交商品级字段，不含价格/库存/SKU；后端强制未发布 + price_pending。
  async function createDraftProduct() {
    const name = draftForm.name.trim();
    if (!name) {
      setError('请先填写草稿商品名称。');
      return;
    }

    const payload: CreateDraftProductPayload = {
      name,
      category: draftForm.category.trim() || undefined,
      description: draftForm.description.trim() || undefined,
      internalNote: draftForm.internalNote.trim() || undefined
    };

    try {
      setCreatingDraft(true);
      setError('');
      setFeedback('');
      const created = await adminApi.createDraftProduct(payload);
      setFeedback('价格未定草稿已创建（未发布、无规格、顾客端不可见）。可在「价格未定草稿」筛选中查看。');
      setDraftForm(EMPTY_DRAFT_FORM);
      await load();
      setSelectedId(created.id);
      setProductFilter('price_pending');
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建价格未定草稿失败');
    } finally {
      setCreatingDraft(false);
    }
  }

  async function saveProductEdit() {
    if (!selectedProduct) {
      setError('请先选择一个商品再进行编辑。');
      return;
    }

    if (!canSaveEdit) {
      setError(`请先补齐商品编辑信息：${editFormMissingFields.join('、')}。`);
      return;
    }

    const payload: UpdateProductPayload = {
      name: trimmedEditForm.name,
      description: trimmedEditForm.description || undefined,
      coverImageUrl: trimmedEditForm.coverImageUrl || undefined,
      supportsPickup: trimmedEditForm.supportsPickup,
      supportsShipping: trimmedEditForm.supportsShipping,
      // Phase 2.39C：内部标签/备注（仅后台，不影响顾客端/发布状态）。
      internalTag: editForm.internalTag.trim(),
      internalNote: editForm.internalNote.trim(),
      ...(selectedProductIsSingleSku
        ? {
            defaultSkuName: trimmedEditForm.defaultSkuName,
            defaultPriceCents: trimmedEditForm.defaultPriceCents
          }
        : {})
    };

    try {
      setSavingEdit(true);
      setError('');
      setFeedback('');
      await adminApi.updateProduct(selectedProduct.id, payload);
      setFeedback('商品编辑已保存。');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存商品编辑失败');
    } finally {
      setSavingEdit(false);
    }
  }

  async function publishSelected() {
    if (!selectedProduct) return;

    // Phase 2.49D：发布前二次确认（与下架/停售 SKU 保持一致），防误点一键发布导致发布数漂移。
    const confirmed = window.confirm(
      `确认发布选中的商品「${selectedProduct.name}」吗？\n请确认价格、图片、库存和门店可售均已审核。发布后将出现在前台商品列表。`
    );
    if (!confirmed) return;

    try {
      setPublishing(true);
      setError('');
      setFeedback('');
      await adminApi.publishProduct(selectedProduct.id);
      setFeedback('商品已发布，列表已刷新。');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '发布商品失败');
    } finally {
      setPublishing(false);
    }
  }

  // Phase 2.38C：下架（软下架）当前选中商品，带二次确认防误点。
  async function unpublishSelected() {
    if (!selectedProduct) return;
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(`确认下架「${selectedProduct.name}」？\n下架为软下架（isPublished=false），不删除商品/规格，历史订单不受影响，顾客端将不再展示该商品。`);
      if (!confirmed) return;
    }

    try {
      setUnpublishing(true);
      setError('');
      setFeedback('');
      await adminApi.unpublishProduct(selectedProduct.id);
      setFeedback('商品已下架（未发布），列表已刷新。');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '下架商品失败');
    } finally {
      setUnpublishing(false);
    }
  }

  // Phase 2.38C：保存单个 SKU 的名称/价格（元→分），支持多 SKU 商品。
  async function saveSku(skuId: string) {
    const draft = skuDrafts[skuId];
    if (!draft) return;
    const name = draft.name.trim();
    const priceCents = yuanInputToCents(draft.price);
    if (!name) {
      setError('规格名称不能为空');
      return;
    }
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      setError('规格价格无效');
      return;
    }

    try {
      setSavingSkuId(skuId);
      setError('');
      setFeedback('');
      await adminApi.updateSku(skuId, { name, priceCents });
      setFeedback('规格已保存，列表已刷新。');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存规格失败');
    } finally {
      setSavingSkuId('');
    }
  }

  // Phase 2.38D：停用/启用 SKU（软禁用）。停用前二次确认。
  async function toggleSkuActive(skuId: string, skuName: string, nextActive: boolean) {
    if (!nextActive && typeof window !== 'undefined') {
      const confirmed = window.confirm(
        `确认停售规格「${skuName}」？\n停售为软禁用（isActive=false），不删除规格、不影响历史订单；顾客端将无法再选择/购买该规格。可随时重新启用。`
      );
      if (!confirmed) return;
    }

    try {
      setSavingSkuId(skuId);
      setError('');
      setFeedback('');
      await adminApi.updateSku(skuId, { isActive: nextActive });
      setFeedback(nextActive ? '规格已启用，列表已刷新。' : '规格已停售，列表已刷新。');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新规格状态失败');
    } finally {
      setSavingSkuId('');
    }
  }

  // Phase 2.38C：为当前商品新增一个 SKU（多规格）。新 SKU 初始库存 0。
  async function addSkuToSelected() {
    if (!selectedProduct) return;
    const name = newSku.name.trim();
    const priceCents = yuanInputToCents(newSku.price);
    if (!name) {
      setError('新规格名称不能为空');
      return;
    }
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      setError('新规格价格无效');
      return;
    }

    try {
      setAddingSku(true);
      setError('');
      setFeedback('');
      await adminApi.addSku(selectedProduct.id, { name, priceCents });
      setFeedback('新规格已创建（初始库存 0），列表已刷新。');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '新增规格失败');
    } finally {
      setAddingSku(false);
    }
  }

  return (
    <AdminPage
      eyebrow="商品管理"
      title="查看商品、规格结构与发布状态"
      description="页面优先区分商品级信息和规格级价格信息，同时让发布状态与履约支持能力更易扫读。"
      breadcrumbs={[
        { label: '控制台首页', href: '/' },
        { label: '商品管理' }
      ]}
      actions={
        <div className="admin-hero-actions">
          <Link className="admin-button-secondary" href="/">
            返回控制台
          </Link>
          <button className="admin-button-ghost" type="button" onClick={load}>
            刷新商品
          </button>
        </div>
      }
    >
      {error ? <AdminAlert title="加载商品失败" message={error} /> : null}
      {feedback ? <AdminAlert title="商品更新" message={feedback} tone="success" /> : null}
      {suspectedTestProducts.length > 0 ? (
        <AdminAlert
          title="发现疑似测试商品"
          message={`检测到 ${suspectedTestProducts.length} 条名称或说明带有测试特征的商品。本轮只做报告提醒，不自动删除正式数据。`}
          tone="info"
        />
      ) : null}

      <div className="admin-metric-grid">
        <section className="admin-metric-card">
          <span className="admin-kpi-label">商品数</span>
          <strong className="admin-kpi-value">{data.length}</strong>
          <p className="admin-helper">当前后台商品接口返回的商品记录总数。</p>
        </section>
        <section className="admin-metric-card">
          <span className="admin-kpi-label">已发布</span>
          <strong className="admin-kpi-value">{data.filter((item) => item.isPublished).length}</strong>
          <p className="admin-helper">已发布商品在满足前台浏览条件后即可对顾客可见。</p>
        </section>
        <section className="admin-metric-card">
          <span className="admin-kpi-label">未发布</span>
          <strong className="admin-kpi-value">{data.filter((item) => !item.isPublished).length}</strong>
          <p className="admin-helper">未发布商品仍需发布后才能面向顾客展示。</p>
        </section>
        <section className="admin-metric-card">
          <span className="admin-kpi-label">规格数量</span>
          <strong className="admin-kpi-value">{data.reduce((sum, item) => sum + item.skus.length, 0)}</strong>
          <p className="admin-helper">用于帮助运营快速判断每个商品下有多少价格与履约差异。</p>
        </section>
      </div>

      <div className="admin-grid">
        <div className="admin-main">
          <AdminSection
            title="商品列表"
            description="默认仅显示已发布（当前运营）商品；可切换查看未发布、历史测试或全部。未发布商品不会出现在顾客端。"
          >
            <div className="admin-badges" style={{ marginBottom: '16px' }}>
              {([
                { key: 'published', label: '已发布', count: productCounts.published },
                { key: 'unpublished', label: '未发布', count: productCounts.unpublished },
                { key: 'price_pending', label: '价格未定草稿', count: productCounts.price_pending },
                { key: 'demo', label: '历史测试', count: productCounts.demo },
                { key: 'all', label: '全部', count: productCounts.all }
              ] as Array<{ key: ProductFilterKey; label: string; count: number }>).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={productFilter === tab.key ? 'admin-button' : 'admin-button-secondary'}
                  onClick={() => setProductFilter(tab.key)}
                >
                  {tab.label} {tab.count}
                </button>
              ))}
            </div>
            {loading ? (
              <AdminLoadingBlocks count={4} />
            ) : visibleProducts.length === 0 ? (
              <AdminEmpty
                title="当前筛选下暂无商品"
                message="切换上方筛选可查看其它分类的商品。未发布商品不会出现在顾客端。"
                action={
                  <div className="admin-actions-row">
                    <button className="admin-button" type="button" onClick={() => setProductFilter('all')}>
                      查看全部
                    </button>
                  </div>
                }
              />
            ) : (
              <div className="admin-list">
                {visibleProducts.map((product) => {
                  const statusMeta = getProductStatusMeta(product);
                  const isSelected = selectedProduct?.id === product.id;

                  return (
                    <article
                      key={product.id}
                      className={`admin-order-card admin-product-card ${isSelected ? 'admin-inventory-card-selected' : ''}`}
                    >
                      <div className="admin-order-header">
                        <div className="admin-title-stack">
                          <h2 className="admin-section-title">{product.name}</h2>
                          <p className="admin-helper">{product.description?.trim() || '暂未填写商品说明。'}</p>
                        </div>
                        <div className="admin-badges">
                          <AdminBadge tone={statusMeta.tone}>{statusMeta.label}</AdminBadge>
                          <AdminBadge tone="neutral">{product.skus.length} 个规格</AdminBadge>
                          <AdminBadge tone="neutral">{product.category || '未分类'}</AdminBadge>
                          {product.isRecommended ? <AdminBadge tone="success">首页推荐</AdminBadge> : null}
                          {isPricePendingDraft(product) ? (
                            <AdminBadge tone="accent">价格未定</AdminBadge>
                          ) : isHistoricalDemoProduct(product) ? (
                            <AdminBadge tone="neutral">历史测试</AdminBadge>
                          ) : isBusinessHiddenProduct(product) ? (
                            <AdminBadge tone="accent">业务暂不上架</AdminBadge>
                          ) : null}
                        </div>
                      </div>

                      {isPricePendingDraft(product) ? (
                        <p className="admin-helper">价格未定草稿：未发布、无规格、顾客端不可见、不可下单；确认价格后再新增规格并发布。</p>
                      ) : isHistoricalDemoProduct(product) ? (
                        <p className="admin-helper">历史测试：测试/演示遗留，保留历史订单引用，勿删。</p>
                      ) : isBusinessHiddenProduct(product) ? (
                        <p className="admin-helper">业务暂不上架：不会出现在顾客端，可后续重新发布。</p>
                      ) : null}

                      <div className="admin-order-row">
                        <div className="admin-title-stack">
                          <p className="admin-helper">{statusMeta.description}</p>
                          <p className="admin-helper">{getProductMerchandisingHint(product)}</p>
                        </div>
                        <div className="admin-kpi">
                          <span className="admin-kpi-label">价格区间</span>
                          <span className="admin-kpi-value">{getProductPriceSummary(product)}</span>
                        </div>
                      </div>

                      <div className="admin-badges">
                        <AdminBadge tone={product.supportsPickup ? 'success' : 'neutral'}>
                          {product.supportsPickup ? '支持自提' : '未开启自提'}
                        </AdminBadge>
                        <AdminBadge tone={product.supportsShipping ? 'success' : 'neutral'}>
                          {product.supportsShipping ? '支持发货' : '未开启发货'}
                        </AdminBadge>
                      </div>

                      <div className="admin-card-actions">
                        <button className="admin-button" type="button" onClick={() => setSelectedId(product.id)}>
                          {isSelected ? '已选中当前商品' : '查看商品'}
                        </button>
                        <Link className="admin-button-secondary" href="/inventory">
                          打开库存页
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </AdminSection>
        </div>

        <aside className="admin-sidebar">
          <AdminSection
            title="新建价格未定草稿"
            description="价格还没确定的商品先建成草稿：只填商品名/分类/说明/内部备注，不填价格、不填库存、不建规格。草稿为未发布状态、顾客端不可见、不可加入购物车或下单；确认价格后再新增规格并发布。"
          >
            <div className="admin-summary-stack">
              <div className="admin-form-field">
                <label htmlFor="draft-name">商品名称</label>
                <input
                  id="draft-name"
                  className="admin-input"
                  value={draftForm.name}
                  onChange={(event) => setDraftForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="例如：1680黄花胶"
                />
              </div>

              <div className="admin-form-field">
                <label htmlFor="draft-category">分类（选填）</label>
                <input
                  id="draft-category"
                  className="admin-input"
                  value={draftForm.category}
                  onChange={(event) => setDraftForm((current) => ({ ...current, category: event.target.value }))}
                  placeholder="例如：花胶类"
                />
              </div>

              <div className="admin-form-field">
                <label htmlFor="draft-description">商品说明（选填）</label>
                <textarea
                  id="draft-description"
                  className="admin-textarea"
                  value={draftForm.description}
                  onChange={(event) => setDraftForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="简要描述商品。"
                />
              </div>

              <div className="admin-form-field">
                <label htmlFor="draft-internal-note">内部备注（仅后台，选填）</label>
                <textarea
                  id="draft-internal-note"
                  className="admin-textarea"
                  value={draftForm.internalNote}
                  onChange={(event) => setDraftForm((current) => ({ ...current, internalNote: event.target.value }))}
                  placeholder="例如：价格未定 / 待图片 / 来源：全量清单"
                />
              </div>

              <div className="admin-info-panel">
                <span className="admin-info-title">草稿说明</span>
                <p className="admin-helper">不会创建任何规格(SKU)与价格，不会写入 0 元/占位价；标签自动标记为「价格未定」。</p>
                <p className="admin-helper">草稿不会出现在顾客端，也不能被加入购物车或下单。</p>
              </div>

              <div className="admin-actions-row">
                <button className="admin-button" type="button" disabled={creatingDraft || loading || !draftForm.name.trim()} onClick={createDraftProduct}>
                  {creatingDraft ? '正在创建草稿...' : '新建价格未定草稿'}
                </button>
              </div>
            </div>
          </AdminSection>

          <AdminSection
            title="创建可售商品"
            description="当前只做最小上架闭环：创建商品时同时生成默认单规格、初始库存和可售门店关系。"
          >
            <div className="admin-summary-stack">
              <div className="admin-form-field">
                <label htmlFor="product-name">商品名称</label>
                <input
                  id="product-name"
                  className="admin-input"
                  value={createForm.name}
                  onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="例如：精选花胶筒"
                />
              </div>

              <div className="admin-form-field">
                <label htmlFor="product-description">商品说明</label>
                <textarea
                  id="product-description"
                  className="admin-textarea"
                  value={createForm.description}
                  onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="简要描述商品卖点、规格或配送说明。"
                />
              </div>

              <div className="admin-form-field">
                <label htmlFor="product-cover">封面图 URL</label>
                <input
                  id="product-cover"
                  className="admin-input"
                  value={createForm.coverImageUrl}
                  onChange={(event) => setCreateForm((current) => ({ ...current, coverImageUrl: event.target.value }))}
                  placeholder="https://example.com/product-cover.jpg"
                />
                <ProductCoverPreview url={createForm.coverImageUrl} title="新建商品封面预览" />
              </div>

              <div className="admin-info-panel">
                <span className="admin-info-title">履约支持</span>
                <div className="admin-badges">
                  <button
                    className={createForm.supportsPickup ? 'admin-button' : 'admin-button-secondary'}
                    type="button"
                    onClick={() => setCreateForm((current) => ({ ...current, supportsPickup: !current.supportsPickup }))}
                  >
                    {createForm.supportsPickup ? '支持自提' : '未开启自提'}
                  </button>
                  <button
                    className={createForm.supportsShipping ? 'admin-button' : 'admin-button-secondary'}
                    type="button"
                    onClick={() => setCreateForm((current) => ({ ...current, supportsShipping: !current.supportsShipping }))}
                  >
                    {createForm.supportsShipping ? '支持发货' : '未开启发货'}
                  </button>
                </div>
              </div>

              <div className="admin-form-field">
                <label htmlFor="default-sku-name">默认规格名称</label>
                <input
                  id="default-sku-name"
                  className="admin-input"
                  value={createForm.defaultSkuName}
                  onChange={(event) => setCreateForm((current) => ({ ...current, defaultSkuName: event.target.value }))}
                  placeholder="例如：250克"
                />
              </div>

              <div className="admin-form-field">
                <label htmlFor="default-sku-code">默认规格编码（选填）</label>
                <input
                  id="default-sku-code"
                  className="admin-input"
                  value={createForm.defaultSkuCode}
                  onChange={(event) => setCreateForm((current) => ({ ...current, defaultSkuCode: event.target.value }))}
                  placeholder="留空则由后端自动生成"
                />
              </div>

              <div className="admin-form-field">
                <label htmlFor="default-price">价格（元）</label>
                <input
                  id="default-price"
                  className="admin-input"
                  inputMode="decimal"
                  value={createForm.defaultPriceCents}
                  onChange={(event) => setCreateForm((current) => ({ ...current, defaultPriceCents: event.target.value }))}
                  placeholder="例如：128.00，不能小于 0"
                />
              </div>

              <div className="admin-form-field">
                <label htmlFor="initial-store">初始门店</label>
                <select
                  id="initial-store"
                  className="admin-input"
                  value={createForm.initialStoreId}
                  onChange={(event) => setCreateForm((current) => ({ ...current, initialStoreId: event.target.value }))}
                >
                  <option value="">请选择门店</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-form-field">
                <label htmlFor="initial-stock">初始库存</label>
                <input
                  id="initial-stock"
                  className="admin-input"
                  inputMode="numeric"
                  value={createForm.initialStock}
                  onChange={(event) => setCreateForm((current) => ({ ...current, initialStock: event.target.value }))}
                  placeholder="例如：20"
                />
              </div>

              <div className="admin-info-panel">
                <span className="admin-info-title">创建说明</span>
                <p className="admin-helper">本次创建会自动生成 1 个默认可售规格，并把实物库存与可售库存初始化为填写的初始库存。</p>
                <p className="admin-helper">当前还缺少：{createFormMissingFields.length > 0 ? createFormMissingFields.join('、') : '无，可直接创建。'}</p>
              </div>

              <div className="admin-actions-row">
                <button className="admin-button" type="button" disabled={!canCreate} onClick={createProduct}>
                  {creating ? '正在创建...' : '创建可售商品'}
                </button>
              </div>
            </div>
          </AdminSection>

          <AdminSection
            title="编辑当前商品"
            description="当前只补商品最小编辑闭环，不扩展到多规格编辑器。"
          >
            {!selectedProduct ? (
              <AdminEmpty
                title="请选择商品"
                message="先从商品列表中选择一个商品，再编辑商品基础信息与默认规格。"
              />
            ) : (
              <div className="admin-summary-stack">
                <div className="admin-form-field">
                  <label htmlFor="edit-product-name">商品名称</label>
                  <input
                    id="edit-product-name"
                    className="admin-input"
                    value={editForm.name}
                    onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="请输入商品名称"
                  />
                </div>

                <div className="admin-form-field">
                  <label htmlFor="edit-product-description">商品说明</label>
                  <textarea
                    id="edit-product-description"
                    className="admin-textarea"
                    value={editForm.description}
                    onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))}
                    placeholder="请输入商品说明"
                  />
                </div>

                <div className="admin-form-field">
                  <label htmlFor="edit-product-cover">封面图 URL</label>
                  <input
                    id="edit-product-cover"
                    className="admin-input"
                    value={editForm.coverImageUrl}
                    onChange={(event) => setEditForm((current) => ({ ...current, coverImageUrl: event.target.value }))}
                  placeholder="https://example.com/product-cover.jpg"
                />
                <ProductCoverPreview url={editForm.coverImageUrl} title="当前商品封面预览" />
              </div>

                <div className="admin-form-field">
                  <label htmlFor="edit-internal-tag">内部标签（仅后台，不对顾客展示）</label>
                  <select
                    id="edit-internal-tag"
                    className="admin-input"
                    value={editForm.internalTag}
                    onChange={(event) => setEditForm((current) => ({ ...current, internalTag: event.target.value }))}
                  >
                    <option value="">普通商品（无标签）</option>
                    <option value="business_hidden">业务暂不上架</option>
                    <option value="historical_demo">历史测试 / Demo</option>
                  </select>
                  <p className="admin-helper">内部分类，不影响顾客端展示与商品发布状态。</p>
                </div>

                <div className="admin-form-field">
                  <label htmlFor="edit-internal-note">内部备注（仅后台）</label>
                  <textarea
                    id="edit-internal-note"
                    className="admin-textarea"
                    value={editForm.internalNote}
                    onChange={(event) => setEditForm((current) => ({ ...current, internalNote: event.target.value }))}
                    placeholder="如：业务暂不上架原因 / 历史测试说明"
                  />
                </div>

                <div className="admin-info-panel">
                  <span className="admin-info-title">履约支持</span>
                  <div className="admin-badges">
                    <button
                      className={editForm.supportsPickup ? 'admin-button' : 'admin-button-secondary'}
                      type="button"
                      onClick={() => setEditForm((current) => ({ ...current, supportsPickup: !current.supportsPickup }))}
                    >
                      {editForm.supportsPickup ? '支持自提' : '未开启自提'}
                    </button>
                    <button
                      className={editForm.supportsShipping ? 'admin-button' : 'admin-button-secondary'}
                      type="button"
                      onClick={() => setEditForm((current) => ({ ...current, supportsShipping: !current.supportsShipping }))}
                    >
                      {editForm.supportsShipping ? '支持发货' : '未开启发货'}
                    </button>
                  </div>
                </div>

                <div className="admin-form-field">
                  <label htmlFor="edit-default-sku-name">默认规格名称</label>
                  <input
                    id="edit-default-sku-name"
                    className="admin-input"
                    value={editForm.defaultSkuName}
                    onChange={(event) => setEditForm((current) => ({ ...current, defaultSkuName: event.target.value }))}
                    placeholder="请输入默认规格名称"
                    disabled={!selectedProductIsSingleSku}
                  />
                </div>

                <div className="admin-form-field">
                  <label htmlFor="edit-default-sku-price">默认规格价格（元）</label>
                  <input
                    id="edit-default-sku-price"
                    className="admin-input"
                    inputMode="decimal"
                    value={editForm.defaultPriceCents}
                    onChange={(event) => setEditForm((current) => ({ ...current, defaultPriceCents: event.target.value }))}
                    placeholder="例如：128.00"
                    disabled={!selectedProductIsSingleSku}
                  />
                </div>

                <div className="admin-info-panel">
                  <span className="admin-info-title">当前选中商品</span>
                  <p className="admin-helper">{selectedProduct.name}</p>
                  <p className="admin-helper">封面图：{selectedProduct.coverImageUrl?.trim() || '暂未填写'}</p>
                  <p className="admin-helper">创建时间：{formatDateTime(selectedProduct.createdAt)}</p>
                  <p className="admin-helper">更新时间：{formatDateTime(selectedProduct.updatedAt)}</p>
                  <div className="admin-badges">
                    <AdminBadge tone={getProductStatusMeta(selectedProduct).tone}>{getProductStatusMeta(selectedProduct).label}</AdminBadge>
                    <AdminBadge tone="neutral">{selectedProduct.category || '未分类'}</AdminBadge>
                    {selectedProduct.isRecommended ? <AdminBadge tone="success">首页推荐</AdminBadge> : null}
                  </div>
                </div>

                <div className="admin-info-panel">
                  <span className="admin-info-title">商品摘要</span>
                  <p className="admin-helper">{getProductMerchandisingHint(selectedProduct)}</p>
                  <p className="admin-helper">规格数量：{selectedProduct.skus.length}</p>
                  <p className="admin-helper">价格区间：{getProductPriceSummary(selectedProduct)}</p>
                  <p className="admin-helper">
                    {selectedProductIsSingleSku ? '当前商品可使用本次最小编辑同步更新默认规格。' : '当前最小编辑仅支持单规格商品；该商品不会允许同步改默认规格。'}
                  </p>
                </div>

                <div className="admin-item-list">
                  {selectedProduct.skus.length === 0 ? (
                    <div className="admin-info-panel">
                      <span className="admin-info-title">规格结构</span>
                      <p className="admin-helper">当前商品还没有挂接规格。</p>
                    </div>
                  ) : (
                    selectedProduct.skus.map((sku) => (
                      <div key={sku.id} className="admin-item-card">
                        <div className="admin-item-header">
                          <div className="admin-title-stack">
                            <AdminBadge tone={sku.isActive === false ? 'neutral' : 'success'}>
                              {sku.isActive === false ? '已停售' : '启用中'}
                            </AdminBadge>
                            <p className="admin-helper">规格编码：{sku.code}</p>
                            <p className="admin-helper">当前价格：{formatMoney(sku.priceCents)}</p>
                          </div>
                        </div>
                        <div className="admin-field">
                          <label htmlFor={`sku-name-${sku.id}`}>规格名称</label>
                          <input
                            id={`sku-name-${sku.id}`}
                            value={skuDrafts[sku.id]?.name ?? sku.name}
                            onChange={(event) =>
                              setSkuDrafts((current) => ({
                                ...current,
                                [sku.id]: { name: event.target.value, price: current[sku.id]?.price ?? centsToYuanInput(sku.priceCents) }
                              }))
                            }
                          />
                        </div>
                        <div className="admin-field">
                          <label htmlFor={`sku-price-${sku.id}`}>价格（元）</label>
                          <input
                            id={`sku-price-${sku.id}`}
                            inputMode="decimal"
                            value={skuDrafts[sku.id]?.price ?? centsToYuanInput(sku.priceCents)}
                            onChange={(event) =>
                              setSkuDrafts((current) => ({
                                ...current,
                                [sku.id]: { name: current[sku.id]?.name ?? sku.name, price: event.target.value }
                              }))
                            }
                          />
                        </div>
                        <div className="admin-actions-row">
                          <button
                            className="admin-button-secondary"
                            type="button"
                            disabled={savingSkuId === sku.id}
                            onClick={() => saveSku(sku.id)}
                          >
                            {savingSkuId === sku.id ? '正在保存...' : '保存该规格'}
                          </button>
                          <button
                            className="admin-button-secondary"
                            type="button"
                            disabled={savingSkuId === sku.id}
                            onClick={() => toggleSkuActive(sku.id, sku.name, sku.isActive === false)}
                          >
                            {sku.isActive === false ? '启用规格' : '停售规格'}
                          </button>
                        </div>
                      </div>
                    ))
                  )}

                  <div className="admin-item-card">
                    <span className="admin-info-title">新增规格 SKU</span>
                    <p className="admin-helper">新增规格初始库存为 0，并在该商品现有铺货门店建立可售关系；价格请填元，提交按分存储。</p>
                    <div className="admin-field">
                      <label htmlFor="new-sku-name">新规格名称</label>
                      <input
                        id="new-sku-name"
                        value={newSku.name}
                        placeholder="如：500克 / 一斤 / 小包"
                        onChange={(event) => setNewSku((current) => ({ ...current, name: event.target.value }))}
                      />
                    </div>
                    <div className="admin-field">
                      <label htmlFor="new-sku-price">新规格价格（元）</label>
                      <input
                        id="new-sku-price"
                        inputMode="decimal"
                        value={newSku.price}
                        placeholder="如：9.8"
                        onChange={(event) => setNewSku((current) => ({ ...current, price: event.target.value }))}
                      />
                    </div>
                    <button className="admin-button-secondary" type="button" disabled={addingSku} onClick={addSkuToSelected}>
                      {addingSku ? '正在新增...' : '新增规格'}
                    </button>
                  </div>
                </div>

                <div className="admin-info-panel">
                  <span className="admin-info-title">主要动作</span>
                  <p className="admin-helper">
                    当前后端契约下，先保存商品基础信息与默认规格，再决定是否发布，是当前最小编辑闭环的主要动作。
                  </p>
                  <p className="admin-helper">当前还缺少：{editFormMissingFields.length > 0 ? editFormMissingFields.join('、') : '无，可直接保存。'}</p>
                </div>

                <div className="admin-actions-row">
                  <button className="admin-button-secondary" type="button" disabled={!canSaveEdit} onClick={saveProductEdit}>
                    {savingEdit ? '正在保存...' : '保存商品编辑'}
                  </button>
                  <button
                    className="admin-button"
                    type="button"
                    disabled={selectedProduct.isPublished || publishing}
                    onClick={publishSelected}
                  >
                    {publishing ? '正在发布...' : selectedProduct.isPublished ? '已发布' : '发布商品'}
                  </button>
                  {selectedProduct.isPublished ? (
                    <button
                      className="admin-button-secondary"
                      type="button"
                      disabled={unpublishing}
                      onClick={unpublishSelected}
                    >
                      {unpublishing ? '正在下架...' : '下架（取消发布）'}
                    </button>
                  ) : null}
                  <Link className="admin-button-secondary" href="/inventory">
                    查看库存
                  </Link>
                </div>
              </div>
            )}
          </AdminSection>
        </aside>
      </div>
    </AdminPage>
  );
}

function ProductCoverPreview({ url, title }: { url: string; title: string }) {
  const trimmedUrl = url.trim();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [trimmedUrl]);

  if (!trimmedUrl || failed) {
    return (
      <div className="admin-cover-placeholder">
        <span className="admin-info-title">{title}</span>
        <p className="admin-helper">{trimmedUrl ? '图片暂时无法加载，请检查链接。' : '填写封面图链接后，这里会显示预览。'}</p>
      </div>
    );
  }

  return (
    <div className="admin-cover-preview">
      <img src={trimmedUrl} alt={title} onError={() => setFailed(true)} />
    </div>
  );
}
