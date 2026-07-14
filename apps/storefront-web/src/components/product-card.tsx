import Link from 'next/link';

import type { ProductSummary } from '../lib/api';
import { getProductInitials, getStartingPriceCents } from '../lib/format';
import { Badge, PriceBlock } from './ui';

export function ProductCard({ product }: { product: ProductSummary }) {
  const startingPrice = getStartingPriceCents(product.skus);

  return (
    <article className="product-card">
      <div className="product-media">
        {product.coverImageUrl?.trim() ? (
          <img className="product-media-image" src={product.coverImageUrl} alt={product.name} />
        ) : (
          <span className="product-media-label" aria-hidden="true">
            {getProductInitials(product.name)}
          </span>
        )}
      </div>

      <div className="product-content">
        <div className="product-heading">
          <h2 className="product-title">{product.name}</h2>
          <p className="muted-text line-clamp-3">
            {product.description?.trim() || '新鲜海鲜商品，支持清晰流畅的自提或发货下单体验。'}
          </p>
        </div>

        <div className="badge-row">
          <Badge tone="accent">{product.skus.length} 个 SKU 规格</Badge>
          <Badge tone="neutral">支持到店自提或邮寄发货</Badge>
        </div>

        <PriceBlock label="起售价" amountCents={startingPrice} />

        <div className="card-actions">
          <Link className="button" href={`/products/${product.id}`}>
            查看详情
          </Link>
        </div>
      </div>
    </article>
  );
}
