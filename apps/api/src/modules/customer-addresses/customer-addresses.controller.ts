import { Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import { CustomerAuthArtifactGuard } from '../auth-exchange/customer-auth-artifact.guard';
import type { VerifiedCustomerAuthIdentity } from '../auth-exchange/customer-auth-artifact.service';
import { Roles } from '../../common/roles/roles.decorator';
import { UserRole } from '../../common/roles/role.enum';
import { RolesGuard } from '../../common/roles/roles.guard';
import { CreateCustomerAddressDto } from './dto/customer-address.dto';
import { CustomerAddressesService } from './customer-addresses.service';

@Controller('customer/addresses')
export class CustomerAddressesController {
  constructor(private readonly customerAddressesService: CustomerAddressesService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.CUSTOMER)
  list(@Headers('x-user-id') userId: string) {
    return this.customerAddressesService.list(userId);
  }

  @Get('authenticated')
  @UseGuards(CustomerAuthArtifactGuard)
  listAuthenticated(@Req() req: { authenticatedCustomer: VerifiedCustomerAuthIdentity }) {
    return this.customerAddressesService.list(req.authenticatedCustomer.userId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.CUSTOMER)
  create(@Headers('x-user-id') userId: string, @Body() dto: CreateCustomerAddressDto) {
    return this.customerAddressesService.create(userId, dto);
  }

  @Post('authenticated')
  @UseGuards(CustomerAuthArtifactGuard)
  createAuthenticated(
    @Req() req: { authenticatedCustomer: VerifiedCustomerAuthIdentity },
    @Body() dto: CreateCustomerAddressDto
  ) {
    return this.customerAddressesService.create(req.authenticatedCustomer.userId, dto);
  }

  @Post(':id/set-default')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CUSTOMER)
  setDefault(@Headers('x-user-id') userId: string, @Param('id') id: string) {
    return this.customerAddressesService.setDefault(userId, id);
  }

  @Post(':id/set-default/authenticated')
  @UseGuards(CustomerAuthArtifactGuard)
  setDefaultAuthenticated(@Req() req: { authenticatedCustomer: VerifiedCustomerAuthIdentity }, @Param('id') id: string) {
    return this.customerAddressesService.setDefault(req.authenticatedCustomer.userId, id);
  }
}
