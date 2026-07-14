import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Controller('stores')
export class StoresStorefrontController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  listActiveStores(@Query('skuId') skuId?: string) {
    const trimmedSkuId = skuId?.trim();

    return this.prisma.store.findMany({
      where: {
        isActive: true,
        ...(trimmedSkuId
          ? {
              availabilities: {
                some: {
                  skuId: trimmedSkuId,
                  isEnabled: true
                }
              },
              inventories: {
                some: {
                  skuId: trimmedSkuId,
                  availableStock: { gt: 0 }
                }
              }
            }
          : {})
      },
      select: {
        id: true,
        name: true,
        address: true
      },
      orderBy: { createdAt: 'asc' }
    });
  }
}
