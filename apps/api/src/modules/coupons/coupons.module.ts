import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CustomerAuthArtifactGuard } from '../auth-exchange/customer-auth-artifact.guard';
import { CustomerAuthArtifactService } from '../auth-exchange/customer-auth-artifact.service';
import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';

@Module({
  controllers: [CouponsController],
  providers: [PrismaService, CustomerAuthArtifactService, CustomerAuthArtifactGuard, CouponsService],
  exports: [CouponsService]
})
export class CouponsModule {}
