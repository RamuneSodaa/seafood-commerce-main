import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { CustomerAuthArtifactGuard } from '../auth-exchange/customer-auth-artifact.guard';
import type { VerifiedCustomerAuthIdentity } from '../auth-exchange/customer-auth-artifact.service';
import { BindReferralDto } from './dto/referral.dto';
import { ReferralsService } from './referrals.service';

@Controller('referrals')
@UseGuards(CustomerAuthArtifactGuard)
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get('my-invite')
  getMyInvite(@Req() req: { authenticatedCustomer: VerifiedCustomerAuthIdentity }) {
    return this.referrals.getMyInvite(req.authenticatedCustomer.userId);
  }

  @Get('summary')
  getSummary(@Req() req: { authenticatedCustomer: VerifiedCustomerAuthIdentity }) {
    return this.referrals.getSummary(req.authenticatedCustomer.userId);
  }

  @Post('bind')
  bindReferral(@Req() req: { authenticatedCustomer: VerifiedCustomerAuthIdentity }, @Body() dto: BindReferralDto) {
    return this.referrals.bindReferral(req.authenticatedCustomer.userId, dto.inviteCode);
  }
}
