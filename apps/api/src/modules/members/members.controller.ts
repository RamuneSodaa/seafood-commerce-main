import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { CustomerAuthArtifactGuard } from '../auth-exchange/customer-auth-artifact.guard';
import type { VerifiedCustomerAuthIdentity } from '../auth-exchange/customer-auth-artifact.service';
import { MembersService } from './members.service';

@Controller('members')
@UseGuards(CustomerAuthArtifactGuard)
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get('me')
  getMe(@Req() req: { authenticatedCustomer: VerifiedCustomerAuthIdentity }) {
    return this.members.getMe(req.authenticatedCustomer.userId);
  }
}
