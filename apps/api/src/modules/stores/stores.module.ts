import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';
import { StoresStorefrontController } from './stores.storefront.controller';

@Module({
  imports: [AdminAuthModule],
  controllers: [StoresController, StoresStorefrontController],
  providers: [PrismaService, StoresService]
})
export class StoresModule {}
