import type { AuthSuccessResult } from '../../../../../packages/shared-types/src';
import { BadRequestException, Injectable } from '@nestjs/common';
import { UserRole } from '../../common/roles/role.enum';
import { AuthExchangePlaceholderDto } from './dto/auth-exchange.dto';
import {
  CustomerAuthArtifactService,
  type VerifiedCustomerAuthIdentity
} from './customer-auth-artifact.service';
import { RealAuthExchangeDto } from './dto/real-auth-exchange.dto';
import { WechatMiniappAuthClient } from './wechat-miniapp-auth.client';
import { MembersService } from '../members/members.service';

export type RealAuthExchangeSuccessResult = AuthSuccessResult & {
  authArtifact: string;
};

@Injectable()
export class AuthExchangeService {
  constructor(
    private readonly wechatMiniappAuthClient: WechatMiniappAuthClient,
    private readonly customerAuthArtifactService: CustomerAuthArtifactService,
    private readonly members: MembersService = {
      ensureMemberProfile: async () => undefined
    } as unknown as MembersService
  ) {}

  exchangePlaceholder(dto: AuthExchangePlaceholderDto): AuthSuccessResult {
    return {
      provider: dto.provider,
      userId: dto.userId.trim(),
      role: UserRole.CUSTOMER,
      displayName: dto.displayName?.trim() || undefined,
      raw: dto.raw
    };
  }

  async exchangeReal(dto: RealAuthExchangeDto): Promise<RealAuthExchangeSuccessResult> {
    const providerCode = dto.providerCode.trim();

    if (!providerCode) {
      throw new BadRequestException('Missing providerCode');
    }

    const exchangedIdentity = await this.wechatMiniappAuthClient.exchangeCode(providerCode);
    const authenticatedCustomer: VerifiedCustomerAuthIdentity = {
      provider: 'wechat',
      userId: `wechat:${exchangedIdentity.openId}`,
      role: UserRole.CUSTOMER
    };
    await this.members.ensureMemberProfile(authenticatedCustomer.userId);

    return {
      ...authenticatedCustomer,
      authArtifact: this.customerAuthArtifactService.issue(authenticatedCustomer)
    };
  }
}
