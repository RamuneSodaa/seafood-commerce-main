import type { AuthSuccessResult } from '../../../../../packages/shared-types/src';
import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import {
  CustomerAuthArtifactGuard
} from './customer-auth-artifact.guard';
import type { VerifiedCustomerAuthIdentity } from './customer-auth-artifact.service';
import { AuthExchangePlaceholderDto } from './dto/auth-exchange.dto';
import { RealAuthExchangeDto } from './dto/real-auth-exchange.dto';
import { AuthExchangeService, type RealAuthExchangeSuccessResult } from './auth-exchange.service';

type AuthenticatedCustomerRequest = {
  authenticatedCustomer: VerifiedCustomerAuthIdentity;
};

@Controller('auth')
export class AuthExchangeController {
  constructor(private readonly authExchangeService: AuthExchangeService) {}

  @Post('exchange-placeholder')
  exchangePlaceholder(@Body() dto: AuthExchangePlaceholderDto): AuthSuccessResult {
    return this.authExchangeService.exchangePlaceholder(dto);
  }

  @Post('exchange-real')
  exchangeReal(@Body() dto: RealAuthExchangeDto): Promise<RealAuthExchangeSuccessResult> {
    return this.authExchangeService.exchangeReal(dto);
  }

  @Get('verify-customer-artifact')
  @UseGuards(CustomerAuthArtifactGuard)
  verifyCustomerArtifact(@Req() req: AuthenticatedCustomerRequest): VerifiedCustomerAuthIdentity {
    return req.authenticatedCustomer;
  }
}
