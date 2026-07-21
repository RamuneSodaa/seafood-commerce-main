import { evaluateProductPublishable } from '../src/modules/products/product-publish-guard';

describe('production priced draft publish guard', () => {
  it('blocks PRICED_DRAFT_REVIEW_REQUIRED even when SKU and cover image otherwise look publishable', () => {
    const blocks = evaluateProductPublishable({
      id: 'test-production-priced-draft',
      category: '海产干货',
      internalTag: 'production_priced_drafts_20260721',
      coverImageUrl: 'assets/products/test.jpg',
      internalNote: JSON.stringify({
        productionState: 'PRICED_DRAFT_REVIEW_REQUIRED',
      }),
      skus: [
        {
          priceCents: 11800,
          isActive: true,
        },
      ],
    });

    expect(
      blocks.map((block) => block.code),
    ).toContain('BLOCKED_PRICED_DRAFT_REVIEW_REQUIRED');
  });

  it('does not add the priced-draft block after the review-required state is removed', () => {
    const blocks = evaluateProductPublishable({
      id: 'test-reviewed-product',
      category: '海产干货',
      internalTag: 'production_priced_drafts_20260721',
      coverImageUrl: 'assets/products/test.jpg',
      internalNote: JSON.stringify({
        productionState: 'OPERATIONALLY_APPROVED',
      }),
      skus: [
        {
          priceCents: 11800,
          isActive: true,
        },
      ],
    });

    expect(
      blocks.map((block) => block.code),
    ).not.toContain('BLOCKED_PRICED_DRAFT_REVIEW_REQUIRED');
  });
});
