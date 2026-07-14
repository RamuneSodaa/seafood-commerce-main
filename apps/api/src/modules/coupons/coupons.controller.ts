import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { CustomerAuthArtifactGuard } from '../auth-exchange/customer-auth-artifact.guard';
import type { VerifiedCustomerAuthIdentity } from '../auth-exchange/customer-auth-artifact.service';
import { CouponsService } from './coupons.service';
import { ClaimCouponDto } from './dto/coupon.dto';

@Controller('coupons')
@UseGuards(CustomerAuthArtifactGuard)
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Get('my')
  getMyCoupons(@Req() req: { authenticatedCustomer: VerifiedCustomerAuthIdentity }) {
    return this.coupons.listMyCoupons(req.authenticatedCustomer.userId);
  }

  @Get('available')
  getAvailableCoupons(@Req() req: { authenticatedCustomer: VerifiedCustomerAuthIdentity }) {
    return this.coupons.listAvailableCoupons(req.authenticatedCustomer.userId);
  }

  @Get('claimable')
  getClaimableCoupons(@Req() req: { authenticatedCustomer: VerifiedCustomerAuthIdentity }) {
    return this.coupons.listClaimableTemplates(req.authenticatedCustomer.userId);
  }

  @Post('claim')
  claimCoupon(@Req() req: { authenticatedCustomer: VerifiedCustomerAuthIdentity }, @Body() dto: ClaimCouponDto) {
    return this.coupons.claimCoupon(req.authenticatedCustomer.userId, dto);
  }
}
