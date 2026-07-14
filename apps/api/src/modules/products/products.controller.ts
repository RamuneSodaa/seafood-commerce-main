import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import type { RequestWithAdmin } from '../admin-auth/admin-auth.types';
import { AdminRoles } from '../admin-auth/admin-role.decorator';
import { AdminRoleGuard } from '../admin-auth/admin-role.guard';
import { CreateDraftProductDto, CreateProductDto, CreateSkuDto, UpdateProductDto, UpdateSkuDto } from './dto/product.dto';
import { ProductsService } from './products.service';

@Controller('admin/products')
@UseGuards(AdminAuthGuard, AdminRoleGuard)
@AdminRoles(AdminRole.ADMIN)
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list() {
    return this.products.list();
  }

  @Post()
  create(@Body() dto: CreateProductDto, @Req() req: RequestWithAdmin) {
    return this.products.create(dto, req.admin?.adminId);
  }

  // Phase 2.45B：价格未定草稿商品建档（不建 SKU/库存，isPublished=false，internalTag=price_pending）。
  @Post('draft')
  createDraft(@Body() dto: CreateDraftProductDto, @Req() req: RequestWithAdmin) {
    return this.products.createDraft(dto, req.admin?.adminId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto, @Req() req: RequestWithAdmin) {
    return this.products.update(id, dto, req.admin?.adminId);
  }

  @Post(':id/publish')
  publish(@Param('id') id: string, @Req() req: RequestWithAdmin) {
    return this.products.publish(id, req.admin?.adminId);
  }

  // Phase 2.38C：后台下架（软下架，isPublished=false）。
  @Post(':id/unpublish')
  unpublish(@Param('id') id: string, @Req() req: RequestWithAdmin) {
    return this.products.unpublish(id, req.admin?.adminId);
  }

  // Phase 2.38C：后台为已有商品新增 SKU（多规格管理）。
  @Post(':productId/skus')
  addSku(@Param('productId') productId: string, @Body() dto: CreateSkuDto, @Req() req: RequestWithAdmin) {
    return this.products.addSku(productId, dto, req.admin?.adminId);
  }
}

// Phase 2.42A：后台操作审计日志查询（仅 ADMIN，避免 STORE_STAFF 看到价格变更历史）。
@Controller('admin/audit-logs')
@UseGuards(AdminAuthGuard, AdminRoleGuard)
@AdminRoles(AdminRole.ADMIN)
export class AdminAuditLogController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(
    @Query('limit') limit?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('action') action?: string
  ) {
    return this.products.listAuditLogs({
      limit: limit ? Number(limit) : undefined,
      entityType,
      entityId,
      action
    });
  }
}

// Phase 2.38C：后台单 SKU 编辑（名称/价格），支持多 SKU 商品。
@Controller('admin/skus')
@UseGuards(AdminAuthGuard, AdminRoleGuard)
@AdminRoles(AdminRole.ADMIN)
export class SkusController {
  constructor(private readonly products: ProductsService) {}

  @Patch(':skuId')
  updateSku(@Param('skuId') skuId: string, @Body() dto: UpdateSkuDto, @Req() req: RequestWithAdmin) {
    return this.products.updateSku(skuId, dto, req.admin?.adminId);
  }
}
