'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AlertMessage, Badge, EmptyState, PageShell, PriceBlock, SectionCard } from '../../../components/ui';
import { formatPriceCents, getProductInitials } from '../../../lib/format';
import { getProduct, type ProductDetail } from '../../../lib/api';

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSku, setSelectedSku] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!params?.id) {
      setLoading(false);
      setError('缺少商品编号');
      return;
    }

    let isActive = true;

    async function loadProduct() {
      setLoading(true);
      setError('');

      try {
        const data = await getProduct(params.id);
        if (isActive) {
          setProduct(data);
          setSelectedSku(data.skus?.[0]?.id || '');
        }
      } catch (e) {
        if (isActive) {
          setError(e instanceof Error ? e.message : '加载商品失败');
          setProduct(null);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    loadProduct();

    return () => {
      isActive = false;
    };
  }, [params?.id]);

  const activeSku = useMemo(
    () => product?.skus.find((sku) => sku.id === selectedSku) ?? product?.skus[0] ?? null,
    [product, selectedSku]
  );

  const canBuy = Boolean(product && activeSku);
  const skuCount = product?.skus.length ?? 0;

  return (
    <PageShell
      eyebrow="商品详情"
      title={product?.name || '商品概览'}
      description={
        product?.description?.trim() ||
        '查看当前商品的 SKU 规格与价格信息，并继续进入下单流程。'
      }
      breadcrumbs={[
        { label: '商品', href: '/' },
        { label: product?.name || '商品详情' }
      ]}
      actions={
        <>
          <Link className="button-secondary" href="/">
            返回商品列表
          </Link>
          <Link className="button-ghost" href="/orders">
            查看我的订单
          </Link>
        </>
      }
    >
      {error ? <AlertMessage title="加载商品失败" message={error} /> : null}

      {loading ? (
        <section className="detail-panel">
          <div className="skeleton-card" />
        </section>
      ) : !product ? (
        <EmptyState
          title="商品不可用"
          message="当前无法找到该商品，或该商品已不再对前台开放。"
          action={
            <div className="action-row">
              <Link className="button" href="/">
                返回商品列表
              </Link>
            </div>
          }
        />
      ) : (
        <div className="detail-grid">
          <div className="detail-main">
            <section className="detail-panel detail-hero-card">
              <div className="detail-media">
                {product.coverImageUrl?.trim() ? (
                  <img className="detail-media-image" src={product.coverImageUrl} alt={product.name} />
                ) : (
                  <span className="detail-media-label" aria-hidden="true">
                    {getProductInitials(product.name)}
                  </span>
                )}
              </div>

              <div className="detail-content">
                <div className="badge-row">
                  <Badge tone="accent">{skuCount} 个 SKU 规格</Badge>
                  <Badge tone="success">支持到店自提与邮寄发货</Badge>
                </div>

                {activeSku ? <PriceBlock label="当前选中价格" amountCents={activeSku.priceCents} /> : null}

                <ul className="detail-list">
                  <li>
                    <strong>当前选择规格</strong>
                    <span>{activeSku?.name || '暂无可选 SKU'}</span>
                  </li>
                  <li>
                    <strong>商品说明</strong>
                    <span>{product.description?.trim() || '适合直接进入下单流程的海鲜商品。'}</span>
                  </li>
                  <li>
                    <strong>履约方式</strong>
                    <span>下单时可根据需求选择到店自提或邮寄发货。</span>
                  </li>
                </ul>
              </div>
            </section>

            <SectionCard
              title="下单前重点信息"
              description="当前详情页优先展示顾客下单前最关心的信息：买的是什么、选的是哪个规格、价格是多少，以及如何履约。"
            >
              <div className="badge-row">
                <Badge tone="neutral">价格清晰</Badge>
                <Badge tone="neutral">减少下单前疑问</Badge>
                <Badge tone="neutral">兼容现有下单接口</Badge>
              </div>
            </SectionCard>
          </div>

          <aside className="detail-panel">
            <h2 className="section-title">选择规格</h2>
            <p className="section-copy">选择你现在想购买的 SKU，进入下单页时会继续沿用当前路由参数方式。</p>

            <label className="field-label" htmlFor="sku-select">
              SKU 规格
            </label>
            <select
              id="sku-select"
              className="select"
              value={selectedSku}
              onChange={(e) => setSelectedSku(e.target.value)}
              disabled={skuCount === 0}
            >
              {product.skus.map((sku) => (
                <option key={sku.id} value={sku.id}>
                  {sku.name} - {formatPriceCents(sku.priceCents)}
                </option>
              ))}
            </select>

            <p className="helper-text">
              下单页仍可继续选择门店、数量和履约方式；这里优先帮你把商品规格确认清楚。
            </p>

            <div className="action-row">
              <button
                className="button"
                disabled={!canBuy}
                onClick={() => {
                  if (!product || !activeSku) return;
                  router.push(`/checkout?productId=${product.id}&skuId=${activeSku.id}`);
                }}
              >
                购买当前规格
              </button>
            </div>
          </aside>
        </div>
      )}
    </PageShell>
  );
}
