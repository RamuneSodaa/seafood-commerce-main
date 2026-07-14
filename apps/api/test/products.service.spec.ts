import { ProductsService } from '../src/modules/products/products.service';

describe('ProductsService update minimal edit guardrails', () => {
  test('updates product and default SKU when product has exactly one SKU', async () => {
    const tx = {
      product: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'product-1',
          supportsPickup: true,
          supportsShipping: true,
          skus: [{ id: 'sku-1', name: '旧规格', priceCents: 1000 }]
        }),
        update: jest.fn().mockResolvedValue({}),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'product-1',
          name: '新商品名',
          supportsPickup: true,
          supportsShipping: true,
          skus: [{ id: 'sku-1', name: '新规格', priceCents: 1280 }]
        })
      },
      sku: {
        update: jest.fn().mockResolvedValue({})
      }
    };

    const prisma: any = {
      $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)
    };

    const service = new ProductsService(prisma);
    const updated = await service.update('product-1', {
      name: ' 新商品名 ',
      defaultSkuName: ' 新规格 ',
      defaultPriceCents: 1280
    });

    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 'product-1' },
      data: {
        name: '新商品名',
        description: undefined,
        coverImageUrl: undefined,
        supportsPickup: undefined,
        supportsShipping: undefined
      }
    });
    expect(tx.sku.update).toHaveBeenCalledWith({
      where: { id: 'sku-1' },
      data: {
        name: '新规格',
        priceCents: 1280
      }
    });
    expect(updated.skus[0].name).toBe('新规格');
  });

  test('rejects default SKU edit when product has multiple SKUs', async () => {
    const tx = {
      product: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'product-1',
          supportsPickup: true,
          supportsShipping: true,
          skus: [{ id: 'sku-1' }, { id: 'sku-2' }]
        })
      }
    };

    const prisma: any = {
      $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)
    };

    const service = new ProductsService(prisma);

    await expect(
      service.update('product-1', {
        defaultSkuName: '新规格'
      })
    ).rejects.toThrow('Current minimal edit only supports single-SKU products');
  });

  test('rejects disabling both pickup and shipping during edit', async () => {
    const tx = {
      product: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'product-1',
          supportsPickup: true,
          supportsShipping: true,
          skus: [{ id: 'sku-1' }]
        })
      }
    };

    const prisma: any = {
      $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)
    };

    const service = new ProductsService(prisma);

    await expect(
      service.update('product-1', {
        supportsPickup: false,
        supportsShipping: false
      })
    ).rejects.toThrow('Product must support at least one fulfillment type');
  });
});
