import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CouponGrantReason,
  CouponRedemptionAction,
  CouponTemplateStatus,
  OrderStatus,
  Prisma,
  UserCouponStatus,
  type CouponTemplate,
  type UserCoupon
} from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';

type DbClient = PrismaService | Prisma.TransactionClient;

export type ResolvedUserCoupon = UserCoupon & {
  template: CouponTemplate;
};

export type CouponApplicationInput = {
  userCouponId: string;
  couponTemplateId: string;
  couponCodeSnapshot: string;
  couponNameSnapshot: string;
  amountCents: number;
};

type GrantCouponInput = {
  customerId: string;
  templateCode: string;
  reason: CouponGrantReason;
  referrerCustomerId?: string;
  referredCustomerId?: string;
  orderId?: string;
};

const PENDING_PAYMENT_EXPIRATION_MINUTES = 30;

function isTemplateUsable(template: CouponTemplate, now = new Date()): boolean {
  if (template.status !== CouponTemplateStatus.ACTIVE) return false;
  if (template.validFrom && template.validFrom > now) return false;
  if (template.validTo && template.validTo < now) return false;
  return true;
}

function formatCoupon(template: CouponTemplate, userCoupon?: UserCoupon) {
  return {
    id: userCoupon?.id,
    templateId: template.id,
    code: template.code,
    name: template.name,
    description: template.description,
    discountType: template.discountType,
    thresholdAmountCents: template.thresholdAmountCents,
    discountAmountCents: template.discountAmountCents,
    discountPercent: template.discountPercent,
    maxDiscountAmountCents: template.maxDiscountAmountCents,
    scene: template.scene,
    stackGroup: template.stackGroup,
    canStack: template.canStack,
    priority: template.priority,
    autoGrantOnNewUser: template.autoGrantOnNewUser,
    validFrom: template.validFrom,
    validTo: template.validTo,
    status: userCoupon?.status,
    lockedOrderId: userCoupon?.lockedOrderId,
    usedOrderId: userCoupon?.usedOrderId,
    expiresAt: userCoupon?.expiresAt || template.validTo,
    claimedAt: userCoupon?.claimedAt
  };
}

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  async expirePendingPaymentOrdersForCustomer(customerId: string, db: DbClient = this.prisma) {
    const cutoff = new Date(Date.now() - PENDING_PAYMENT_EXPIRATION_MINUTES * 60 * 1000);
    const orders = await db.order.findMany({
      where: {
        customerId,
        status: OrderStatus.PENDING_PAYMENT,
        createdAt: { lt: cutoff }
      },
      select: { id: true }
    });

    let expiredOrderCount = 0;
    let releasedCouponCount = 0;

    for (const order of orders) {
      const updateResult = await db.order.updateMany({
        where: {
          id: order.id,
          status: OrderStatus.PENDING_PAYMENT
        },
        data: { status: OrderStatus.CANCELLED }
      });

      if (updateResult.count === 0) {
        continue;
      }

      expiredOrderCount += 1;
      releasedCouponCount += await db.userCoupon.count({
        where: {
          lockedOrderId: order.id,
          status: UserCouponStatus.LOCKED
        }
      });

      await db.orderStatusLog.create({
        data: {
          orderId: order.id,
          fromStatus: OrderStatus.PENDING_PAYMENT,
          toStatus: OrderStatus.CANCELLED,
          action: 'EXPIRE_PENDING_PAYMENT_ORDER',
          reason: '支付超时自动取消，优惠券已释放。'
        }
      });
      await this.releaseLockedCouponsForOrder(db, order.id);
    }

    return { expiredOrderCount, releasedCouponCount };
  }

  async ensureNewUserBenefits(customerId: string, db: DbClient = this.prisma) {
    const templates = await db.couponTemplate.findMany({
      where: {
        autoGrantOnNewUser: true,
        status: CouponTemplateStatus.ACTIVE
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }]
    });

    const ensured: ResolvedUserCoupon[] = [];

    for (const template of templates) {
      if (!isTemplateUsable(template)) {
        continue;
      }

      ensured.push(await this.grantCoupon(db, {
        customerId,
        templateCode: template.code,
        reason: CouponGrantReason.NEW_USER
      }));
    }

    return ensured.map((coupon) => formatCoupon(coupon.template, coupon));
  }

  async listMyCoupons(customerId: string) {
    await this.expirePendingPaymentOrdersForCustomer(customerId);
    await this.ensureNewUserBenefits(customerId);
    const coupons = await this.prisma.userCoupon.findMany({
      where: { customerId },
      include: { template: true },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }]
    });

    return coupons.map((coupon) => formatCoupon(coupon.template, coupon));
  }

  async listAvailableCoupons(customerId: string) {
    await this.expirePendingPaymentOrdersForCustomer(customerId);
    await this.ensureNewUserBenefits(customerId);
    const now = new Date();
    const coupons = await this.prisma.userCoupon.findMany({
      where: {
        customerId,
        status: UserCouponStatus.CLAIMED,
        OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
        template: {
          status: CouponTemplateStatus.ACTIVE,
          OR: [{ validFrom: null }, { validFrom: { lte: now } }],
          AND: [{ OR: [{ validTo: null }, { validTo: { gte: now } }] }]
        }
      },
      include: { template: true },
      orderBy: [{ template: { priority: 'desc' } }, { expiresAt: 'asc' }, { createdAt: 'desc' }]
    });

    return coupons.map((coupon) => formatCoupon(coupon.template, coupon));
  }

  async listClaimableTemplates(customerId: string) {
    await this.expirePendingPaymentOrdersForCustomer(customerId);
    await this.ensureNewUserBenefits(customerId);
    const now = new Date();
    const templates = await this.prisma.couponTemplate.findMany({
      where: {
        status: CouponTemplateStatus.ACTIVE,
        scene: { in: ['NEW_USER', 'GENERAL'] },
        autoGrantOnNewUser: false,
        OR: [{ validFrom: null }, { validFrom: { lte: now } }],
        AND: [{ OR: [{ validTo: null }, { validTo: { gte: now } }] }]
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }]
    });

    const existingCounts = await this.prisma.userCoupon.groupBy({
      by: ['templateId'],
      where: {
        customerId,
        templateId: { in: templates.map((template) => template.id) }
      },
      _count: { templateId: true }
    });
    const byTemplate = new Map(existingCounts.map((row) => [row.templateId, row._count.templateId]));

    return templates
      .filter((template) => (byTemplate.get(template.id) || 0) < template.perUserLimit)
      .map((template) => formatCoupon(template));
  }

  async claimCoupon(customerId: string, input: { templateCode?: string; templateId?: string }) {
    if (!input.templateCode?.trim() && !input.templateId?.trim()) {
      throw new BadRequestException('请选择要领取的优惠券。');
    }

    const template = await this.prisma.couponTemplate.findFirst({
      where: {
        ...(input.templateId ? { id: input.templateId } : {}),
        ...(input.templateCode ? { code: input.templateCode.trim() } : {})
      }
    });

    if (!template) {
      throw new NotFoundException('优惠券不存在。');
    }

    if (template.scene !== 'NEW_USER' && template.scene !== 'GENERAL') {
      throw new BadRequestException('当前优惠券暂不支持主动领取。');
    }

    const coupon = await this.grantCoupon(this.prisma, {
      customerId,
      templateCode: template.code,
      reason: template.scene === 'NEW_USER' ? CouponGrantReason.NEW_USER : CouponGrantReason.MANUAL
    });

    return formatCoupon(coupon.template, coupon);
  }

  async grantCoupon(db: DbClient, input: GrantCouponInput): Promise<ResolvedUserCoupon> {
    const template = await db.couponTemplate.findUnique({
      where: { code: input.templateCode }
    });

    if (!template || !isTemplateUsable(template)) {
      throw new BadRequestException('当前优惠券模板不可用。');
    }

    const existingCount = await db.userCoupon.count({
      where: {
        customerId: input.customerId,
        templateId: template.id
      }
    });

    if (existingCount >= template.perUserLimit) {
      return db.userCoupon.findFirstOrThrow({
        where: {
          customerId: input.customerId,
          templateId: template.id
        },
        include: { template: true },
        orderBy: { createdAt: 'desc' }
      });
    }

    const coupon = await db.userCoupon.create({
      data: {
        customerId: input.customerId,
        templateId: template.id,
        status: UserCouponStatus.CLAIMED,
        expiresAt: template.validTo || undefined
      },
      include: { template: true }
    });

    await db.couponGrantLog.create({
      data: {
        customerId: input.customerId,
        templateId: template.id,
        userCouponId: coupon.id,
        reason: input.reason,
        referrerCustomerId: input.referrerCustomerId,
        referredCustomerId: input.referredCustomerId,
        orderId: input.orderId
      }
    });

    return coupon;
  }

  async resolveCouponForQuote(
    db: DbClient,
    input: { customerId?: string; userCouponId?: string; couponCode?: string }
  ): Promise<ResolvedUserCoupon | null> {
    const coupons = await this.resolveCouponsForQuote(db, input);
    return coupons[0] || null;
  }

  async resolveCouponsForQuote(
    db: DbClient,
    input: { customerId?: string; userCouponId?: string; userCouponIds?: string[]; couponCode?: string }
  ): Promise<ResolvedUserCoupon[]> {
    const legacyUserCouponId = input.userCouponId?.trim();
    const selectedCouponIds = [...new Set([
      ...(input.userCouponIds || []).map((id) => id.trim()).filter(Boolean),
      ...(legacyUserCouponId ? [legacyUserCouponId] : [])
    ])];
    const couponCode = input.couponCode?.trim();

    if (selectedCouponIds.length > 0 && couponCode) {
      throw new BadRequestException('优惠码不能和已领取优惠券同时使用。');
    }

    if (selectedCouponIds.length === 0 && !couponCode) {
      return [];
    }

    if (!input.customerId) {
      throw new BadRequestException('请先登录后使用优惠券。');
    }

    const coupons = await db.userCoupon.findMany({
      where: {
        customerId: input.customerId,
        ...(selectedCouponIds.length > 0 ? { id: { in: selectedCouponIds } } : {}),
        ...(couponCode ? { template: { code: couponCode } } : {})
      },
      include: { template: true }
    });

    if (selectedCouponIds.length > 0 && coupons.length !== selectedCouponIds.length) {
      throw new BadRequestException('部分优惠券不存在或不属于当前账号。');
    }

    if (couponCode && coupons.length === 0) {
      throw new BadRequestException('优惠码不存在或尚未领取。');
    }

    const now = new Date();
    for (const coupon of coupons) {
      if (coupon.status !== UserCouponStatus.CLAIMED) {
        throw new BadRequestException('当前优惠券暂不可使用。');
      }

      if (coupon.expiresAt && coupon.expiresAt < now) {
        throw new BadRequestException('当前优惠券已过期。');
      }

      if (!isTemplateUsable(coupon.template, now)) {
        throw new BadRequestException('当前优惠券暂不可用。');
      }
    }

    const stackBlockedCoupon = coupons.find((coupon) => !coupon.template.canStack);
    if (stackBlockedCoupon && coupons.length > 1) {
      throw new BadRequestException(`${stackBlockedCoupon.template.name} 暂不支持与其他优惠券叠加使用。`);
    }

    return coupons.sort((a, b) => b.template.priority - a.template.priority || a.createdAt.getTime() - b.createdAt.getTime());
  }

  async lockCouponForOrder(db: DbClient, input: { userCouponId?: string; orderId: string; amountCents: number }) {
    if (!input.userCouponId) {
      return;
    }

    await this.lockCouponsForOrder(db, {
      orderId: input.orderId,
      applications: [{
        userCouponId: input.userCouponId,
        couponTemplateId: '',
        couponCodeSnapshot: '',
        couponNameSnapshot: '',
        amountCents: input.amountCents
      }]
    });
  }

  async lockCouponsForOrder(db: DbClient, input: { orderId: string; applications: CouponApplicationInput[] }) {
    if (input.applications.length === 0) {
      return;
    }

    for (const application of input.applications) {
      const coupon = await db.userCoupon.findUnique({
        where: { id: application.userCouponId },
        include: { template: true }
      });

      if (!coupon || coupon.status !== UserCouponStatus.CLAIMED) {
        throw new BadRequestException('当前优惠券无法锁定。');
      }

      const couponTemplateId = application.couponTemplateId || coupon.templateId;
      const couponCodeSnapshot = application.couponCodeSnapshot || coupon.template.code;
      const couponNameSnapshot = application.couponNameSnapshot || coupon.template.name;

      await db.userCoupon.update({
        where: { id: application.userCouponId },
        data: {
          status: UserCouponStatus.LOCKED,
          lockedOrderId: input.orderId,
          lockedAt: new Date()
        }
      });
      await db.orderCouponApplication.create({
        data: {
          orderId: input.orderId,
          userCouponId: application.userCouponId,
          couponTemplateId,
          couponCodeSnapshot,
          couponNameSnapshot,
          amountCents: application.amountCents
        }
      });
      await db.couponRedemptionLog.create({
        data: {
          userCouponId: application.userCouponId,
          orderId: input.orderId,
          action: CouponRedemptionAction.LOCK,
          amountCents: application.amountCents
        }
      });
    }
  }

  async useLockedCouponForOrder(db: DbClient, orderId: string) {
    await this.useLockedCouponsForOrder(db, orderId);
  }

  async useLockedCouponsForOrder(db: DbClient, orderId: string) {
    const coupons = await db.userCoupon.findMany({
      where: {
        lockedOrderId: orderId,
        status: UserCouponStatus.LOCKED
      }
    });

    if (coupons.length === 0) {
      return;
    }

    const applications = await db.orderCouponApplication.findMany({
      where: { orderId }
    });
    const amountByCouponId = new Map(applications.map((application) => [application.userCouponId, application.amountCents]));

    for (const coupon of coupons) {
      await db.userCoupon.update({
        where: { id: coupon.id },
        data: {
          status: UserCouponStatus.USED,
          usedOrderId: orderId,
          usedAt: new Date()
        }
      });
      await db.couponRedemptionLog.create({
        data: {
          userCouponId: coupon.id,
          orderId,
          action: CouponRedemptionAction.USE,
          amountCents: amountByCouponId.get(coupon.id) || 0
        }
      });
    }
  }

  async releaseLockedCouponForOrder(db: DbClient, orderId: string) {
    await this.releaseLockedCouponsForOrder(db, orderId);
  }

  async releaseLockedCouponsForOrder(db: DbClient, orderId: string) {
    const coupons = await db.userCoupon.findMany({
      where: {
        lockedOrderId: orderId,
        status: UserCouponStatus.LOCKED
      }
    });

    for (const coupon of coupons) {
      await db.userCoupon.update({
        where: { id: coupon.id },
        data: {
          status: UserCouponStatus.CLAIMED,
          lockedOrderId: null,
          lockedAt: null
        }
      });
      await db.couponRedemptionLog.create({
        data: {
          userCouponId: coupon.id,
          orderId,
          action: CouponRedemptionAction.RELEASE,
          amountCents: 0
        }
      });
    }
  }
}
