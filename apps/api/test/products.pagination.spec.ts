import { NotFoundException } from '@nestjs/common';
import { ProductsService } from '../src/modules/products/products.service';

describe('ProductsService admin pagination', () => {
  function createSubject() {
    const prisma = {
      product: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn()
      },
      sku: {
        count: jest.fn()
      }
    };

    return {
      prisma,
      service: new ProductsService(prisma as never)
    };
  }

  it('returns a compact first page with global counts', async () => {
    const { prisma, service } = createSubject();
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'p1',
        name: '商品一',
        isPublished: true,
        skus: []
      }
    ]);
    prisma.product.count
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(14)
      .mockResolvedValueOnce(230)
      .mockResolvedValueOnce(229)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(244);
    prisma.sku.count.mockResolvedValue(15);

    const result = await service.listAdminPage({
      page: '1',
      pageSize: '8',
      filter: 'published'
    });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 8,
        select: expect.not.objectContaining({ internalNote: true })
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        page: 1,
        pageSize: 8,
        total: 4,
        totalPages: 1,
        counts: {
          published: 14,
          unpublished: 230,
          price_pending: 229,
          demo: 0,
          all: 244,
          skus: 15
        }
      })
    );
  });

  it('clamps page size and applies server-side search/filter', async () => {
    const { prisma, service } = createSubject();
    prisma.product.findMany.mockResolvedValue([]);
    prisma.product.count.mockResolvedValue(0);
    prisma.sku.count.mockResolvedValue(0);

    await service.listAdminPage({
      page: '3',
      pageSize: '999',
      filter: 'price_pending',
      q: ' 鱼胶 '
    });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 40,
        take: 20,
        where: {
          AND: [
            { internalTag: 'price_pending' },
            expect.objectContaining({ OR: expect.any(Array) })
          ]
        }
      })
    );
  });

  it('rejects non-finite, decimal and non-positive pagination values', async () => {
    const { prisma, service } = createSubject();
    prisma.product.findMany.mockResolvedValue([]);
    prisma.product.count.mockResolvedValue(0);
    prisma.sku.count.mockResolvedValue(0);

    const result = await service.listAdminPage({
      page: 'Infinity',
      pageSize: '8.5',
      filter: 'all'
    });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 8
      })
    );
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(8);

    prisma.product.findMany.mockClear();

    await service.listAdminPage({
      page: '0',
      pageSize: '-1',
      filter: 'all'
    });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 8
      })
    );
  });


  it('preserves the legacy all-products default and bounds unsafe page values', async () => {
    const { prisma, service } = createSubject();
    prisma.product.findMany.mockResolvedValue([]);
    prisma.product.count.mockResolvedValue(0);
    prisma.sku.count.mockResolvedValue(0);

    const result = await service.listAdminPage({
      page: '9007199254740992'
    });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 8,
        where: {
          AND: [{}, {}]
        }
      })
    );
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(8);

    prisma.product.findMany.mockClear();

    const capped = await service.listAdminPage({
      page: '100001',
      pageSize: '20'
    });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 1999980,
        take: 20
      })
    );
    expect(capped.page).toBe(100000);
  });

  it('loads one full product detail or throws a 404', async () => {
    const { prisma, service } = createSubject();
    prisma.product.findUnique.mockResolvedValueOnce({
      id: 'p1',
      name: '商品一',
      internalNote: '完整内部备注',
      skus: []
    });

    await expect(service.getAdminDetail('p1')).resolves.toEqual(
      expect.objectContaining({ internalNote: '完整内部备注' })
    );

    prisma.product.findUnique.mockResolvedValueOnce(null);
    await expect(service.getAdminDetail('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
