import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminAuthService } from './admin-auth.service';
import { AdminRoleGuard } from './admin-role.guard';

@Module({
  controllers: [AdminAuthController],
  providers: [PrismaService, AdminAuthService, AdminAuthGuard, AdminRoleGuard],
  exports: [AdminAuthService, AdminAuthGuard, AdminRoleGuard]
})
export class AdminAuthModule {}
