import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CouponGrantReason, Prisma, ReferralEventType, ReferralRelationStatus, ReferralRewardStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { CouponsService } from '../coupons/coupons.service';
import { MembersService } from '../members/members.service';

type DbClient = PrismaService | Prisma.TransactionClient;

const INVITER_REWARD_TEMPLATE_CODE = 'REFERRAL_INVITER_1500';
const INVITEE_FIRST_ORDER_TEMPLATE_CODE = 'REFERRAL_INVITEE_1000';

@Injectable()
export class ReferralsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly members: MembersService,
    private readonly coupons: CouponsService
  ) {}

  private normalizeInviteCode(inviteCode: string): string {
    return inviteCode.trim().toUpperCase();
  }

  async getMyInvite(customerId: string) {
    const profile = await this.members.ensureMemberProfile(customerId);

    return {
      inviteCode: profile.inviteCode,
      shareTitle: '绿膳荟干货海味店',
      sharePath: `/pages/products/index?inviteCode=${profile.inviteCode}`
    };
  }

  async bindReferral(customerId: string, inviteCode: string) {
    const normalizedInviteCode = this.normalizeInviteCode(inviteCode);

    if (!normalizedInviteCode) {
      throw new BadRequestException('邀请码不能为空。');
    }

    return this.prisma.$transaction(async (tx) => {
      const referredProfile = await this.members.ensureMemberProfile(customerId, tx);
      const referrerProfile = await tx.memberProfile.findUnique({
        where: { inviteCode: normalizedInviteCode }
      });

      if (!referrerProfile) {
        throw new NotFoundException('邀请信息不存在。');
      }

      if (referrerProfile.customerId === customerId || referredProfile.inviteCode === normalizedInviteCode) {
        throw new BadRequestException('不能绑定自己的邀请码。');
      }

      const existingRelation = await tx.referralRelation.findUnique({
        where: { referredCustomerId: customerId }
      });

      if (existingRelation) {
        throw new BadRequestException('当前账号已经绑定过邀请关系。');
      }

      const existingPaidOrderCount = await tx.order.count({
        where: {
          customerId,
          status: { notIn: ['PENDING_PAYMENT', 'CANCELLED'] }
        }
      });

      if (existingPaidOrderCount > 0) {
        throw new BadRequestException('已有成交订单的账号暂不能绑定邀请关系。');
      }

      const relation = await tx.referralRelation.create({
        data: {
          referrerCustomerId: referrerProfile.customerId,
          referredCustomerId: customerId,
          inviteCode: normalizedInviteCode,
          status: ReferralRelationStatus.BOUND
        }
      });

      await tx.referralEvent.create({
        data: {
          inviteCode: normalizedInviteCode,
          eventType: ReferralEventType.LOGIN_BIND,
          customerId
        }
      });

      await this.coupons.grantCoupon(tx, {
        customerId,
        templateCode: INVITEE_FIRST_ORDER_TEMPLATE_CODE,
        reason: CouponGrantReason.NEW_USER,
        referrerCustomerId: referrerProfile.customerId,
        referredCustomerId: customerId
      });

      return {
        id: relation.id,
        referrerCustomerId: relation.referrerCustomerId,
        referredCustomerId: relation.referredCustomerId,
        status: relation.status,
        message: '邀请关系已绑定，首单优惠券已发放。'
      };
    });
  }

  async getSummary(customerId: string) {
    const [invite, invitedCount, rewardedCount, relation] = await Promise.all([
      this.getMyInvite(customerId),
      this.prisma.referralRelation.count({ where: { referrerCustomerId: customerId } }),
      this.prisma.referralReward.count({
        where: {
          receiverCustomerId: customerId,
          status: ReferralRewardStatus.GRANTED
        }
      }),
      this.prisma.referralRelation.findUnique({ where: { referredCustomerId: customerId } })
    ]);

    return {
      ...invite,
      invitedCount,
      rewardedCount,
      boundByInviteCode: relation?.inviteCode || null,
      relationStatus: relation?.status || null
    };
  }

  async handleFirstPaidOrder(db: DbClient, referredCustomerId: string, orderId: string) {
    const relation = await db.referralRelation.findUnique({
      where: { referredCustomerId },
      include: { rewards: true }
    });

    if (!relation || relation.status === ReferralRelationStatus.REWARDED || relation.status === ReferralRelationStatus.VOID) {
      return;
    }

    const paidOrderCount = await db.order.count({
      where: {
        customerId: referredCustomerId,
        status: { notIn: ['PENDING_PAYMENT', 'CANCELLED'] }
      }
    });

    if (paidOrderCount !== 1) {
      return;
    }

    const rewardCoupon = await this.coupons.grantCoupon(db, {
      customerId: relation.referrerCustomerId,
      templateCode: INVITER_REWARD_TEMPLATE_CODE,
      reason: CouponGrantReason.REFERRAL_REWARD,
      referrerCustomerId: relation.referrerCustomerId,
      referredCustomerId,
      orderId
    });

    await db.referralRelation.update({
      where: { id: relation.id },
      data: {
        status: ReferralRelationStatus.REWARDED,
        qualifiedOrderId: orderId,
        qualifiedAt: new Date(),
        rewardedAt: new Date()
      }
    });

    await db.referralReward.create({
      data: {
        relationId: relation.id,
        receiverCustomerId: relation.referrerCustomerId,
        userCouponId: rewardCoupon.id,
        status: ReferralRewardStatus.GRANTED
      }
    });

    await db.referralEvent.createMany({
      data: [
        {
          inviteCode: relation.inviteCode,
          eventType: ReferralEventType.FIRST_ORDER_PAID,
          customerId: referredCustomerId,
          orderId
        },
        {
          inviteCode: relation.inviteCode,
          eventType: ReferralEventType.REWARD_GRANTED,
          customerId: relation.referrerCustomerId,
          orderId
        }
      ]
    });
  }
}
