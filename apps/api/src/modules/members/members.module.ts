import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CustomerAuthArtifactGuard } from '../auth-exchange/customer-auth-artifact.guard';
import { CustomerAuthArtifactService } from '../auth-exchange/customer-auth-artifact.service';
import { CouponsModule } from '../coupons/coupons.module';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';

@Module({
  imports: [CouponsModule],
  controllers: [MembersController],
  providers: [PrismaService, CustomerAuthArtifactService, CustomerAuthArtifactGuard, MembersService],
  exports: [MembersService]
})
export class MembersModule {}
