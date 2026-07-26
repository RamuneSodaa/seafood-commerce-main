import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { CustomerAuthArtifactGuard } from '../auth-exchange/customer-auth-artifact.guard';
import type { VerifiedCustomerAuthIdentity } from '../auth-exchange/customer-auth-artifact.service';
import { CreateCustomerAddressDto } from './dto/customer-address.dto';
import { CustomerAddressesService } from './customer-addresses.service';

type AuthenticatedCustomerRequest = {
  authenticatedCustomer: VerifiedCustomerAuthIdentity;
};

@Controller('customer/addresses')
export class CustomerAddressesController {
  constructor(private readonly customerAddressesService: CustomerAddressesService) {}

  @Get()
  @UseGuards(CustomerAuthArtifactGuard)
  list(@Req() req: AuthenticatedCustomerRequest) {
    return this.customerAddressesService.list(req.authenticatedCustomer.userId);
  }

  @Get('authenticated')
  @UseGuards(CustomerAuthArtifactGuard)
  listAuthenticated(@Req() req: AuthenticatedCustomerRequest) {
    return this.customerAddressesService.list(req.authenticatedCustomer.userId);
  }

  @Post()
  @UseGuards(CustomerAuthArtifactGuard)
  create(
    @Req() req: AuthenticatedCustomerRequest,
    @Body() dto: CreateCustomerAddressDto
  ) {
    return this.customerAddressesService.create(
      req.authenticatedCustomer.userId,
      dto
    );
  }

  @Post('authenticated')
  @UseGuards(CustomerAuthArtifactGuard)
  createAuthenticated(
    @Req() req: AuthenticatedCustomerRequest,
    @Body() dto: CreateCustomerAddressDto
  ) {
    return this.customerAddressesService.create(
      req.authenticatedCustomer.userId,
      dto
    );
  }

  @Post(':id/set-default')
  @UseGuards(CustomerAuthArtifactGuard)
  setDefault(
    @Req() req: AuthenticatedCustomerRequest,
    @Param('id') id: string
  ) {
    return this.customerAddressesService.setDefault(
      req.authenticatedCustomer.userId,
      id
    );
  }

  @Post(':id/set-default/authenticated')
  @UseGuards(CustomerAuthArtifactGuard)
  setDefaultAuthenticated(
    @Req() req: AuthenticatedCustomerRequest,
    @Param('id') id: string
  ) {
    return this.customerAddressesService.setDefault(
      req.authenticatedCustomer.userId,
      id
    );
  }
}
