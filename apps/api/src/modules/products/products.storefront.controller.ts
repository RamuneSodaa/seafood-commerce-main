import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsStorefrontController {
  constructor(private readonly products: ProductsService) {}

  // Phase 2.48C：双频道只读过滤（短期不改 schema，用 internalTag 区分）。
  // - 无 channel / channel=dry：保持旧行为，仅返回已发布干货商品（排除 fresh_seafood_catalog）。
  // - channel=fresh：返回新鲜渔产目录（时价/联系确认，不可直接加购，不进支付）。
  @Get()
  listPublished(@Query('category') category?: string, @Query('q') q?: string, @Query('channel') channel?: string) {
    if ((channel || '').trim() === 'fresh') {
      return this.products.listFreshCatalog();
    }
    return this.products.listPublished({ category, q });
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.products.getPublishedDetail(id);
  }
}
