import {
  CouponDiscountType,
  CouponScene,
  CouponTemplateStatus,
  MemberLevel
} from '@prisma/client';
import {
  runSeedScript,
  assertProductionApplyAllowed,
  printDryRunNotice,
  PRODUCTION_MARKETING_CANDIDATES,
  PRODUCTION_PRODUCT_CANDIDATES,
  requirePrisma
} from './seed.shared';

runSeedScript('production marketing seed', async (prisma, options) => {
  assertProductionApplyAllowed(options);

  const pendingTemplates = PRODUCTION_MARKETING_CANDIDATES.filter((template) => template.pendingOperationsApproval);

  console.log('正式营销候选：', PRODUCTION_MARKETING_CANDIDATES.map((template) => ({
    code: template.code,
    name: template.name,
    thresholdAmountCents: template.thresholdAmountCents,
    discountAmountCents: template.discountAmountCents,
    canStack: template.canStack,
    perUserLimit: template.perUserLimit,
    priority: template.priority,
    autoGrantOnNewUser: template.autoGrantOnNewUser,
    pendingOperationsApproval: template.pendingOperationsApproval
  })));

  if (pendingTemplates.length > 0 && !options.args.has('--allow-pending-marketing')) {
    console.log('当前营销规则仍需运营确认。未传入 --allow-pending-marketing 时，apply 会拒绝写入。');
  }

  if (options.mode === 'dry-run') {
    printDryRunNotice();
    console.log('本 seed 不输出或写入任何密码、token、secret。');
    return;
  }

  if (pendingTemplates.length > 0 && !options.args.has('--allow-pending-marketing')) {
    throw new Error('正式营销 seed 仍需运营确认。若在空库演练中使用候选规则，请显式传入 --allow-pending-marketing。');
  }

  const db = requirePrisma(prisma);
  let couponTemplateCount = 0;
  let memberPriceCount = 0;

  for (const template of PRODUCTION_MARKETING_CANDIDATES) {
    await db.couponTemplate.upsert({
      where: { code: template.code },
      update: {
        name: template.name,
        description: template.description,
        discountType: CouponDiscountType.AMOUNT_OFF,
        thresholdAmountCents: template.thresholdAmountCents,
        discountAmountCents: template.discountAmountCents,
        stackGroup: template.stackGroup,
        canStack: template.canStack,
        perUserLimit: template.perUserLimit,
        priority: template.priority,
        autoGrantOnNewUser: template.autoGrantOnNewUser,
        status: CouponTemplateStatus.ACTIVE,
        scene: template.code.startsWith('REFERRAL_INVITER')
          ? CouponScene.REFERRAL_INVITER
          : template.code.startsWith('REFERRAL_INVITEE')
            ? CouponScene.REFERRAL_INVITEE
            : CouponScene.NEW_USER
      },
      create: {
        code: template.code,
        name: template.name,
        description: template.description,
        discountType: CouponDiscountType.AMOUNT_OFF,
        thresholdAmountCents: template.thresholdAmountCents,
        discountAmountCents: template.discountAmountCents,
        stackGroup: template.stackGroup,
        canStack: template.canStack,
        perUserLimit: template.perUserLimit,
        priority: template.priority,
        autoGrantOnNewUser: template.autoGrantOnNewUser,
        status: CouponTemplateStatus.ACTIVE,
        scene: template.code.startsWith('REFERRAL_INVITER')
          ? CouponScene.REFERRAL_INVITER
          : template.code.startsWith('REFERRAL_INVITEE')
            ? CouponScene.REFERRAL_INVITEE
            : CouponScene.NEW_USER
      }
    });
    couponTemplateCount += 1;
  }

  for (const product of PRODUCTION_PRODUCT_CANDIDATES) {
    for (const sku of product.skus) {
      const existingSku = await db.sku.findUnique({ where: { code: sku.code } });
      if (!existingSku) {
        continue;
      }

      await db.skuMemberPrice.upsert({
        where: {
          skuId_memberLevel: {
            skuId: existingSku.id,
            memberLevel: MemberLevel.DEFAULT
          }
        },
        update: {
          priceCents: Math.max(1, Math.floor(sku.priceCents * 0.95 / 100) * 100),
          isActive: true
        },
        create: {
          skuId: existingSku.id,
          memberLevel: MemberLevel.DEFAULT,
          priceCents: Math.max(1, Math.floor(sku.priceCents * 0.95 / 100) * 100),
          isActive: true
        }
      });
      memberPriceCount += 1;
    }
  }

  console.log('正式营销 seed 完成：', { couponTemplateCount, memberPriceCount });
});
