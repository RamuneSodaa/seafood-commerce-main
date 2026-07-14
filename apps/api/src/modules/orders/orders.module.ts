import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { RolesGuard } from '../../common/roles/roles.guard';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { CustomerAuthArtifactGuard } from '../auth-exchange/customer-auth-artifact.guard';
import { CustomerAuthArtifactService } from '../auth-exchange/customer-auth-artifact.service';
import { CouponsModule } from '../coupons/coupons.module';
import { MembersModule } from '../members/members.module';
import { PricingModule } from '../pricing/pricing.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { MiniappPaymentCallbackVerificationService } from './miniapp-payment-callback-verification.service';
import { OrdersController } from './orders.controller';
import { OrderRepository } from './order.repository';
import { OrderWorkflowService } from './order-workflow.service';
import { WechatMiniappPaymentCreateClient } from './wechat-miniapp-payment-create.client';

@Module({
  imports: [AdminAuthModule, PricingModule, CouponsModule, MembersModule, ReferralsModule],
  controllers: [OrdersController],
  providers: [
    PrismaService,
    RolesGuard,
    CustomerAuthArtifactService,
    CustomerAuthArtifactGuard,
    OrderRepository,
    MiniappPaymentCallbackVerificationService,
    WechatMiniappPaymentCreateClient,
    OrderWorkflowService
  ]
})
export class OrdersModule {}
