import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import type { AdminAuthIdentity } from '../admin-auth/admin-auth.types';
import { AdjustInventoryDto, InventoryQueryDto } from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  private getScopedStoreId(q: InventoryQueryDto, admin: AdminAuthIdentity) {
    if (admin.role === AdminRole.ADMIN) {
      return q.storeId;
    }

    if (!admin.storeId) {
      throw new ForbiddenException('Store staff account is not bound to a store');
    }

    if (q.storeId && q.storeId !== admin.storeId) {
      throw new ForbiddenException('Store staff cannot access another store');
    }

    return admin.storeId;
  }

  private assertAdjustScope(dto: AdjustInventoryDto, admin: AdminAuthIdentity) {
    if (admin.role === AdminRole.ADMIN) {
      return;
    }

    if (!admin.storeId || dto.storeId !== admin.storeId) {
      throw new ForbiddenException('Store staff cannot adjust another store');
    }
  }

  query(q: InventoryQueryDto, admin: AdminAuthIdentity) {
    return this.prisma.inventory.findMany({
      where: {
        storeId: this.getScopedStoreId(q, admin),
        skuId: q.skuId
      },
      include: {
        store: true,
        sku: {
          include: { product: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async adjust(dto: AdjustInventoryDto, admin: AdminAuthIdentity) {
    this.assertAdjustScope(dto, admin);
    const reason = dto.reason.trim();
    if (!reason) throw new BadRequestException('Inventory adjustment reason is required');

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id
        FROM "Inventory"
        WHERE "storeId" = ${dto.storeId}
          AND "skuId" = ${dto.skuId}
        FOR UPDATE
      `;

      const inventory = await tx.inventory.findUnique({
        where: { storeId_skuId: { storeId: dto.storeId, skuId: dto.skuId } }
      });
      if (!inventory) throw new NotFoundException('Inventory not found');

      const nextPhysical = inventory.physicalStock + dto.deltaPhysical;
      const nextAvailable = inventory.availableStock + dto.deltaAvailable;
      if (nextPhysical < 0 || nextAvailable < 0) {
        throw new BadRequestException('Negative stock not allowed');
      }

      const updated = await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          physicalStock: nextPhysical,
          availableStock: nextAvailable
        }
      });

      await tx.inventoryLog.create({
        data: {
          inventoryId: inventory.id,
          storeId: inventory.storeId,
          skuId: inventory.skuId,
          action: 'MANUAL_ADJUST',
          deltaPhysical: dto.deltaPhysical,
          deltaAvailable: dto.deltaAvailable,
          deltaReserved: 0,
          oldPhysicalStock: inventory.physicalStock,
          newPhysicalStock: nextPhysical,
          oldAvailableStock: inventory.availableStock,
          newAvailableStock: nextAvailable,
          oldReservedStock: inventory.reservedStock,
          newReservedStock: inventory.reservedStock,
          reason,
          note: dto.note?.trim() || null,
          operatorAdminId: admin.adminId
        }
      });

      return updated;
    });
  }
}
