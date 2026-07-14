'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ProductCard } from '../components/product-card';
import { AlertMessage, EmptyState, LoadingGrid, PageShell, SectionCard } from '../components/ui';
import { getProducts, type ProductSummary } from '../lib/api';

export default function ProductListPage() {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isActive = true;

    async function loadProducts() {
      setLoading(true);
      setError('');

      try {
        const data = await getProducts();
        if (isActive) {
          setProducts(data);
        }
      } catch (e) {
        if (isActive) {
          setError(e instanceof Error ? e.message : '加载商品失败');
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    loadProducts();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <PageShell
      eyebrow="海鲜商城"
      title="挑选今天想买的海鲜商品"
      description="浏览当前可售商品，快速比较不同 SKU 规格与价格，并继续进入下单流程。"
      breadcrumbs={[{ label: '商品' }]}
      actions={
        <>
          <Link className="button" href="/orders">
            查看我的订单
          </Link>
          <a className="button-secondary" href="#product-grid">
            浏览商品
          </a>
        </>
      }
    >
      {error ? <AlertMessage title="加载商品失败" message={error} /> : null}

      <SectionCard
        title="今日可售"
        description="卡片会突出展示起售价、SKU 数量和支持的履约方式，方便顾客快速浏览后进入详情。"
      >
        {loading ? (
          <LoadingGrid />
        ) : products.length === 0 ? (
          <EmptyState
            title="暂无可售商品"
            message="当后台发布商品后，顾客就可以在这里浏览并下单。"
            action={
              <div className="action-row">
                <Link className="button-secondary" href="/orders">
                  查看已有订单
                </Link>
              </div>
            }
          />
        ) : (
          <div id="product-grid" className="card-grid">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </SectionCard>
    </PageShell>
  );
}
