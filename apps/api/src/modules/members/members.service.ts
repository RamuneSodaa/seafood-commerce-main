import { Injectable } from '@nestjs/common';
import { Prisma, type MemberLevel } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../../common/prisma.service';
import { CouponsService } from '../coupons/coupons.service';

type DbClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coupons: CouponsService
  ) {}

  private buildInviteCode(customerId: string): string {
    return createHash('sha256')
      .update(`greenshanhui:${customerId}`)
      .digest('hex')
      .slice(0, 10)
      .toUpperCase();
  }

  async ensureMemberProfile(customerId: string, db: DbClient = this.prisma) {
    const existing = await db.memberProfile.findUnique({ where: { customerId } });

    if (existing) {
      await this.coupons.ensureNewUserBenefits(customerId, db);
      return existing;
    }

    const profile = await db.memberProfile.create({
      data: {
        customerId,
        inviteCode: this.buildInviteCode(customerId),
        isMember: true,
        memberLevel: 'DEFAULT'
      }
    });
    await this.coupons.ensureNewUserBenefits(customerId, db);
    return profile;
  }

  async getMemberLevel(customerId: string, db: DbClient = this.prisma): Promise<MemberLevel> {
    const profile = await this.ensureMemberProfile(customerId, db);
    return profile.memberLevel;
  }

  async getMe(customerId: string) {
    const profile = await this.ensureMemberProfile(customerId);

    return {
      customerId: profile.customerId,
      inviteCode: profile.inviteCode,
      isMember: profile.isMember,
      memberLevel: profile.memberLevel,
      benefits: [
        '登录即享会员价',
        '可领取新人优惠券',
        '邀请好友首单后可获得奖励券'
      ]
    };
  }
}
