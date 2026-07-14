import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { AdminAuditLogController, ProductsController, SkusController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductsStorefrontController } from './products.storefront.controller';

@Module({
  imports: [AdminAuthModule],
  controllers: [ProductsController, SkusController, AdminAuditLogController, ProductsStorefrontController],
  providers: [PrismaService, ProductsService]
})
export class ProductsModule {}
