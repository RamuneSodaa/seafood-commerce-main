#!/usr/bin/env node

const { PrismaClient, OrderStatus, UserCouponStatus, CouponRedemptionAction } = require('@prisma/client');

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const YES = process.argv.includes('--yes');
const TIMEOUT_MINUTES = Number(process.env.PENDING_PAYMENT_TIMEOUT_MINUTES || 30);

async function main() {
  const cutoff = new Date(Date.now() - TIMEOUT_MINUTES * 60 * 1000);
  const orders = await prisma.order.findMany({
    where: {
      status: OrderStatus.PENDING_PAYMENT,
      createdAt: { lt: cutoff }
    },
    select: {
      id: true,
      orderNo: true,
      customerId: true,
      totalAmountCents: true,
      createdAt: true,
      couponApplications: {
        select: {
          userCouponId: true,
          couponNameSnapshot: true,
          amountCents: true
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log(JSON.stringify({
    mode: APPLY ? 'apply' : 'dry-run',
    timeoutMinutes: TIMEOUT_MINUTES,
    pendingExpiredCount: orders.length,
    orders: orders.map((order) => ({
      id: order.id,
      orderNo: order.orderNo,
      customerTail: order.customerId.slice(-8),
      totalAmountCents: order.totalAmountCents,
      createdAt: order.createdAt,
      lockedCouponCount: order.couponApplications.length,
      couponNames: order.couponApplications.map((item) => item.couponNameSnapshot)
    }))
  }, null, 2));

  if (!APPLY) {
    console.log('DRY_RUN_ONLY: add --apply --yes to mark these orders cancelled and release locked coupons.');
    return;
  }

  if (!YES) {
    throw new Error('Refusing to apply without --yes. This script never deletes data, but it changes order status.');
  }

  for (const order of orders) {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: {
          id: order.id,
          status: OrderStatus.PENDING_PAYMENT
        },
        data: { status: OrderStatus.CANCELLED }
      });

      if (updated.count === 0) return;

      await tx.orderStatusLog.create({
        data: {
          orderId: order.id,
          fromStatus: OrderStatus.PENDING_PAYMENT,
          toStatus: OrderStatus.CANCELLED,
          action: 'LOCAL_EXPIRE_PENDING_PAYMENT_ORDER',
          reason: '本地开发脚本：支付超时取消，优惠券已释放。'
        }
      });

      const lockedCoupons = await tx.userCoupon.findMany({
        where: {
          lockedOrderId: order.id,
          status: UserCouponStatus.LOCKED
        },
        select: { id: true }
      });

      for (const coupon of lockedCoupons) {
        await tx.userCoupon.update({
          where: { id: coupon.id },
          data: {
            status: UserCouponStatus.CLAIMED,
            lockedOrderId: null,
            lockedAt: null
          }
        });
        await tx.couponRedemptionLog.create({
          data: {
            userCouponId: coupon.id,
            orderId: order.id,
            action: CouponRedemptionAction.RELEASE,
            amountCents: 0
          }
        });
      }
    });
  }

  console.log('APPLY_DONE: expired pending orders were marked cancelled and locked coupons were released.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
