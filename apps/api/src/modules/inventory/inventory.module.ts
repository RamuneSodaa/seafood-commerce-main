import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  imports: [AdminAuthModule],
  controllers: [InventoryController],
  providers: [PrismaService, InventoryService]
})
export class InventoryModule {}
