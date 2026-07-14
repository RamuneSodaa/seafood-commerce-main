import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import type { RequestWithAdmin } from '../admin-auth/admin-auth.types';
import { AdminRoles } from '../admin-auth/admin-role.decorator';
import { AdminRoleGuard } from '../admin-auth/admin-role.guard';
import { AdjustInventoryDto, InventoryQueryDto } from './dto/inventory.dto';
import { InventoryService } from './inventory.service';

@Controller('admin/inventory')
@UseGuards(AdminAuthGuard, AdminRoleGuard)
@AdminRoles(AdminRole.ADMIN, AdminRole.STORE_STAFF)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  query(@Query() q: InventoryQueryDto, @Req() req: RequestWithAdmin) {
    return this.inventory.query(q, req.admin!);
  }

  @Post('adjust')
  adjust(@Body() dto: AdjustInventoryDto, @Req() req: RequestWithAdmin) {
    return this.inventory.adjust(dto, req.admin!);
  }
}
