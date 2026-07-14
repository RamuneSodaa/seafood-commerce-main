import { Module } from '@nestjs/common';
import { AuthExchangeController } from './auth-exchange.controller';
import { AuthExchangeService } from './auth-exchange.service';
import { CustomerAuthArtifactGuard } from './customer-auth-artifact.guard';
import { CustomerAuthArtifactService } from './customer-auth-artifact.service';
import { WechatMiniappAuthClient } from './wechat-miniapp-auth.client';
import { MembersModule } from '../members/members.module';

@Module({
  imports: [MembersModule],
  controllers: [AuthExchangeController],
  providers: [
    AuthExchangeService,
    WechatMiniappAuthClient,
    CustomerAuthArtifactService,
    CustomerAuthArtifactGuard
  ]
})
export class AuthExchangeModule {}
