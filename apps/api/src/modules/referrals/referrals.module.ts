import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CustomerAuthArtifactGuard } from '../auth-exchange/customer-auth-artifact.guard';
import { CustomerAuthArtifactService } from '../auth-exchange/customer-auth-artifact.service';
import { CouponsModule } from '../coupons/coupons.module';
import { MembersModule } from '../members/members.module';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';

@Module({
  imports: [CouponsModule, MembersModule],
  controllers: [ReferralsController],
  providers: [PrismaService, CustomerAuthArtifactService, CustomerAuthArtifactGuard, ReferralsService],
  exports: [ReferralsService]
})
export class ReferralsModule {}
