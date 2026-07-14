import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { AdminRole, OrderStatus, Prisma } from '@prisma/client';
import { UserRole } from '../../common/roles/role.enum';
import { CouponsService } from '../coupons/coupons.service';
import { MembersService } from '../members/members.service';
import { OrderPricingService } from '../pricing/order-pricing.service';
import { ReferralsService } from '../referrals/referrals.service';
import { OrderRepository } from './order.repository';
import { CreateOrderDto, MiniappPaymentCallbackDto, OrderQuotePreviewDto } from './dto/order-workflow.dto';
import { MiniappPaymentCallbackVerificationService, WechatCallbackSignatureVerificationInput } from './miniapp-payment-callback-verification.service';
import { WechatMiniappPaymentCreateClient } from './wechat-miniapp-payment-create.client';

type RequestActor = {
  role: UserRole | AdminRole;
  userId?: string;
  adminId?: string;
  storeId?: string | null;
};

const ADMIN_ACTOR: RequestActor = { role: UserRole.ADMIN };

function maskTail(value: string | undefined, visibleLength: number): string {
  const normalized = value?.trim();

  if (!normalized) {
    return 'missing';
  }

  if (normalized.length <= visibleLength) {
    return `***${normalized}`;
  }

  return `***${normalized.slice(-visibleLength)}`;
}

@Injectable()
export class OrderWorkflowService {
  constructor(
    private readonly repo: OrderRepository,
    private readonly pricing: OrderPricingService,
    private readonly coupons: CouponsService = {
      resolveCouponForQuote: async () => null,
      resolveCouponsForQuote: async () => [],
      lockCouponForOrder: async () => undefined,
      lockCouponsForOrder: async () => undefined,
      useLockedCouponForOrder: async () => undefined,
      useLockedCouponsForOrder: async () => undefined,
      releaseLockedCouponForOrder: async () => undefined,
      releaseLockedCouponsForOrder: async () => undefined,
      expirePendingPaymentOrdersForCustomer: async () => ({ expiredOrderCount: 0, releasedCouponCount: 0 })
    } as unknown as CouponsService,
    private readonly members: MembersService = {
      getMemberLevel: async () => 'DEFAULT'
    } as unknown as MembersService,
    private readonly referrals: ReferralsService = {
      handleFirstPaidOrder: async () => undefined
    } as unknown as ReferralsService,
    private readonly miniappPaymentCallbackVerification: MiniappPaymentCallbackVerificationService = new MiniappPaymentCallbackVerificationService(),
    private readonly wechatMiniappPaymentCreateClient: WechatMiniappPaymentCreateClient = new WechatMiniappPaymentCreateClient()
  ) {}

  private getWechatOpenIdFromCustomerUserId(userId: string): string {
    const prefix = 'wechat:';
    if (!userId.startsWith(prefix)) {
      throw new BadRequestException('Miniapp payment creation requires a Wechat-authenticated customer');
    }

    const openId = userId.slice(prefix.length).trim();
    if (!openId) {
      throw new BadRequestException('Miniapp payment creation requires a valid Wechat openId');
    }

    return openId;
  }

  private getScopedCustomerId(actor: RequestActor): string | undefined {
    if (actor.role !== UserRole.CUSTOMER) return undefined;
    if (!actor.userId) throw new ForbiddenException('Customer scope requires x-user-id');
    return actor.userId;
  }

  private assertOrderAccess(order: { customerId: string; storeId?: string }, actor: RequestActor) {
    if (actor.role === UserRole.CUSTOMER) {
      if (!actor.userId) throw new ForbiddenException('Customer scope requires x-user-id');
      if (order.customerId !== actor.userId) {
        throw new ForbiddenException('You do not have access to this order');
      }
      return;
    }

    if (actor.role === AdminRole.STORE_STAFF || actor.role === UserRole.STORE) {
      if (!actor.storeId) throw new ForbiddenException('Store staff scope requires storeId');
      if (order.storeId !== actor.storeId) {
        throw new ForbiddenException('Store staff cannot access another store order');
      }
    }
  }

  private getScopedStoreId(actor: RequestActor): string | undefined {
    if (actor.role !== AdminRole.STORE_STAFF && actor.role !== UserRole.STORE) return undefined;
    if (!actor.storeId) throw new ForbiddenException('Store staff scope requires storeId');
    return actor.storeId;
  }

  private getAdminLogOptions(actor: RequestActor, action: string) {
    return {
      action,
      operatorAdminId: actor.adminId
    };
  }

  private async expirePendingOrdersForCustomerIfNeeded(customerId?: string, tx?: Prisma.TransactionClient) {
    if (!customerId) return { expiredOrderCount: 0, releasedCouponCount: 0 };
    return this.coupons.expirePendingPaymentOrdersForCustomer(customerId, tx || undefined);
  }

  private async buildOrderQuote(
    tx: Prisma.TransactionClient,
    dto: Pick<CreateOrderDto, 'storeId' | 'fulfillmentType' | 'items' | 'couponCode' | 'userCouponId' | 'userCouponIds'>,
    customerId?: string
  ) {
    await this.expirePendingOrdersForCustomerIfNeeded(customerId, tx);

    const store = await this.repo.findStore(tx, dto.storeId);
    if (!store || !store.isActive) throw new BadRequestException('Store not available');

    const skuIds = dto.items.map((i) => i.skuId);
    const skus = await this.repo.findSkus(tx, skuIds);
    if (skus.length !== skuIds.length) throw new BadRequestException('Some SKUs are invalid');

    const availability = await this.repo.findAvailability(tx, dto.storeId, skuIds);
    if (availability.length !== skuIds.length) throw new BadRequestException('Some SKUs are not available in selected store');

    const skuMap = new Map(skus.map((s) => [s.id, s]));
    for (const item of dto.items) {
      const sku = skuMap.get(item.skuId)!;
      // Phase 2.51B：新鲜渔产直购——fresh_seafood_catalog 保持 isPublished=false（避免污染干货频道），
      // 但允许进入普通订单 quote（其 Inventory/StoreSkuAvailability/价格已就绪）。dry 仍要求已发布。
      if (!sku.product.isPublished && sku.product.internalTag !== 'fresh_seafood_catalog') {
        throw new BadRequestException('Product is not published');
      }
      // Phase 2.38D：拒绝已停售(软禁用)规格下单，避免静默按旧价成交。
      if (!sku.isActive) throw new BadRequestException('该规格已停售，请重新选择');
      if (dto.fulfillmentType === 'STORE_PICKUP' && !sku.product.supportsPickup) {
        throw new BadRequestException('SKU does not support pickup');
      }
      if (dto.fulfillmentType === 'SHIPPING' && !sku.product.supportsShipping) {
        throw new BadRequestException('SKU does not support shipping');
      }
    }

    const memberLevel = customerId ? await this.members.getMemberLevel(customerId, tx) : undefined;
    const priceMap = new Map(skus.map((s) => {
      const memberPrice = memberLevel
        ? s.memberPrices.find((price) => price.isActive && price.memberLevel === memberLevel)
        : undefined;

      return [
        s.id,
        {
          priceCents: s.priceCents,
          memberPriceCents: memberPrice?.priceCents
        }
      ];
    }));
    const coupons = await this.coupons.resolveCouponsForQuote(tx, {
      customerId,
      userCouponId: dto.userCouponId,
      userCouponIds: dto.userCouponIds,
      couponCode: dto.couponCode
    });

    return this.pricing.quoteListPrice({
      items: dto.items,
      priceMap,
      coupons,
      couponCode: dto.couponCode
    });
  }

  async previewOrderQuote(dto: OrderQuotePreviewDto, customerId?: string) {
    return this.repo.tx(async (tx) => {
      const quote = await this.buildOrderQuote(tx, dto, customerId);
      return {
        subtotalAmountCents: quote.subtotalAmountCents,
        baseAmountCents: quote.baseAmountCents,
        memberDiscountAmountCents: quote.memberDiscountAmountCents,
        couponDiscountAmountCents: quote.couponDiscountAmountCents,
        discountAmountCents: quote.discountAmountCents,
        totalAmountCents: quote.totalAmountCents,
        appliedCouponCode: quote.appliedCouponCode,
        appliedUserCouponId: quote.appliedUserCouponId,
        appliedCouponCodes: quote.appliedCouponCodes,
        appliedUserCouponIds: quote.appliedUserCouponIds,
        couponApplications: quote.couponApplications,
        adjustments: quote.adjustments
      };
    });
  }

  async createOrder(customerId: string, dto: CreateOrderDto) {
    return this.repo.tx(async (tx) => {
      const quote = await this.buildOrderQuote(tx, dto, customerId);
      const { totalAmountCents } = quote;

      if (dto.fulfillmentType === 'STORE_PICKUP' && (!dto.pickupDate || !dto.pickupTimeSlot)) {
        throw new BadRequestException('pickupDate and pickupTimeSlot are required for STORE_PICKUP');
      }

      if (dto.fulfillmentType === 'SHIPPING' && !dto.shippingAddress) {
        throw new BadRequestException('shippingAddress is required for SHIPPING');
      }

      const now = Date.now();
      const orderNo = `SO-${now}`;
      const pickupCode = Math.floor(100000 + Math.random() * 900000).toString();

      const order = await this.repo.createOrder(tx, {
        orderNo,
        customerId,
        store: { connect: { id: dto.storeId } },
        fulfillmentType: dto.fulfillmentType,
        status: OrderStatus.PENDING_PAYMENT,
        subtotalAmountCents: quote.subtotalAmountCents,
        discountAmountCents: quote.discountAmountCents,
        memberDiscountAmountCents: quote.memberDiscountAmountCents,
        couponDiscountAmountCents: quote.couponDiscountAmountCents,
        totalAmountCents,
        appliedCouponCode: quote.appliedCouponCodes.join(',') || quote.appliedCouponCode,
        appliedUserCouponId: quote.appliedUserCouponId,
        pickupDate: dto.pickupDate ? new Date(dto.pickupDate) : undefined,
        pickupTimeSlot: dto.pickupTimeSlot,
        items: {
          create: quote.lines.map((line) => ({
            sku: { connect: { id: line.skuId } },
            quantity: line.quantity,
            unitPriceCents: line.unitPriceCents
          }))
        },
        shippingAddress:
          dto.fulfillmentType === 'SHIPPING' && dto.shippingAddress
            ? {
                create: {
                  receiverName: dto.shippingAddress.receiverName,
                  phone: dto.shippingAddress.phone,
                  province: dto.shippingAddress.province,
                  city: dto.shippingAddress.city,
                  district: dto.shippingAddress.district,
                  detail: dto.shippingAddress.detail,
                  postalCode: dto.shippingAddress.postalCode
                }
              }
            : undefined,
        pickupRecord:
          dto.fulfillmentType === 'STORE_PICKUP'
            ? {
                create: {
                  pickupCode
                }
              }
            : undefined
      });

      await this.repo.insertOrderStatusLog(tx, order.id, null, OrderStatus.PENDING_PAYMENT, 'order created', {
        action: 'CREATE_ORDER'
      });
      await this.coupons.lockCouponsForOrder(tx, {
        orderId: order.id,
        applications: quote.couponApplications
      });

      return {
        id: order.id,
        orderNo: order.orderNo,
        status: order.status,
        totalAmountCents: order.totalAmountCents,
        fulfillmentType: order.fulfillmentType,
        pickupCode: order.pickupRecord?.pickupCode
      };
    });
  }

  // Phase 2.48J：新鲜渔产「提交预订」。仅 fresh-only；写 Order/OrderItem 为预订单，不触发任何支付。
  // 注意：因 OrderStatus 枚举无“预订/待门店确认”值且本阶段禁止改 schema，落库 status 仍用 PENDING_PAYMENT，
  // 但用 OrderNote 标记 orderMode=FRESH_PREORDER/paymentRequired=false；前端对 fresh 预订单隐藏“去支付”，显示“待门店确认”。
  async createFreshPreorder(
    customerId: string,
    dto: { storeId?: string; items: Array<{ skuId: string; quantity: number }> }
  ) {
    const FRESH_TAG = 'fresh_seafood_catalog';
    const PRIMARY_STORE_CODE = 'STORE_GZ_TH_YUANCUN_MARKET';
    if (!dto.items || dto.items.length === 0) throw new BadRequestException('预订车为空');

    return this.repo.tx(async (tx) => {
      // 解析门店：默认主门店（鲜鱼库存/可售挂在该店）
      let storeId = dto.storeId;
      if (!storeId) {
        const store = await tx.store.findUnique({ where: { code: PRIMARY_STORE_CODE }, select: { id: true } });
        if (!store) throw new BadRequestException('鲜鱼预订门店不可用');
        storeId = store.id;
      }
      const store = await this.repo.findStore(tx, storeId);
      if (!store || !store.isActive) throw new BadRequestException('门店不可用');

      const skuIds = dto.items.map((i) => i.skuId);
      const skus = await this.repo.findSkus(tx, skuIds);
      if (skus.length !== skuIds.length) throw new BadRequestException('部分规格无效');
      const skuMap = new Map(skus.map((s) => [s.id, s]));

      // 全部必须是 fresh（拒绝干货与混单）+ active + 已定价
      for (const item of dto.items) {
        const sku = skuMap.get(item.skuId)!;
        if (sku.product.internalTag !== FRESH_TAG) {
          throw new BadRequestException('仅限新鲜渔产预订，普通商品请走正常下单');
        }
        if (!sku.isActive) throw new BadRequestException('该鲜货已停售');
        if (sku.priceCents <= 0) throw new BadRequestException('该鲜货暂未定价');
        if (!item.quantity || item.quantity < 1) throw new BadRequestException('数量无效');
      }

      // 门店可售 + 库存校验
      const availability = await this.repo.findAvailability(tx, storeId, skuIds);
      if (availability.length !== skuIds.length) throw new BadRequestException('部分鲜货在该门店不可售');
      const inventories = await this.repo.getInventoriesForOrder(tx, storeId, skuIds);
      const invBySku = new Map(inventories.map((i) => [i.skuId, i]));
      for (const item of dto.items) {
        const inv = invBySku.get(item.skuId);
        if (!inv || inv.availableStock < item.quantity) {
          throw new BadRequestException('该鲜货库存不足，请联系门店');
        }
      }

      const subtotal = dto.items.reduce((sum, i) => sum + skuMap.get(i.skuId)!.priceCents * i.quantity, 0);
      const now = Date.now();
      const orderNo = `FP-${now}`;
      const pickupCode = Math.floor(100000 + Math.random() * 900000).toString();

      const order = await this.repo.createOrder(tx, {
        orderNo,
        customerId,
        store: { connect: { id: storeId } },
        fulfillmentType: 'STORE_PICKUP',
        status: OrderStatus.PENDING_PAYMENT, // 见方法注释：枚举无预订态，用 OrderNote 标记 + 前端区分
        subtotalAmountCents: subtotal,
        discountAmountCents: 0,
        memberDiscountAmountCents: 0,
        couponDiscountAmountCents: 0,
        totalAmountCents: subtotal,
        items: {
          create: dto.items.map((i) => ({
            sku: { connect: { id: i.skuId } },
            quantity: i.quantity,
            unitPriceCents: skuMap.get(i.skuId)!.priceCents
          }))
        },
        pickupRecord: { create: { pickupCode } }
      });

      await this.repo.insertOrderStatusLog(tx, order.id, null, OrderStatus.PENDING_PAYMENT, 'fresh preorder created (待门店确认，不在线支付)', {
        action: 'CREATE_FRESH_PREORDER'
      });
      await tx.orderNote.create({
        data: {
          orderId: order.id,
          type: 'internal',
          visibility: 'internal',
          body: JSON.stringify({
            orderMode: 'FRESH_PREORDER',
            priceMode: 'REFERENCE_PRICE_PER_JIN',
            unit: '斤',
            actualPriceByStoreScale: true,
            paymentRequired: false,
            note: '鲜鱼预订单，参考金额非最终支付金额，实际价格以门店称重确认为准',
            source: 'phase2_48j_fresh_preorder'
          })
        }
      });

      // 清理该顾客购物车中的 fresh 预订项（仅 fresh，不动干货）
      await tx.cartItem.deleteMany({
        where: {
          cart: { customerId },
          sku: { product: { internalTag: FRESH_TAG } }
        }
      });

      return {
        id: order.id,
        orderNo: order.orderNo,
        status: order.status,
        totalAmountCents: order.totalAmountCents,
        isFreshPreorder: true,
        orderMode: 'FRESH_PREORDER',
        paymentRequired: false,
        pickupCode: order.pickupRecord?.pickupCode
      };
    });
  }

  // Phase 2.48K：判断订单是否为鲜鱼预订单（任一 OrderItem 的 Product.internalTag=fresh_seafood_catalog）。
  private async isFreshPreorderOrder(tx: Prisma.TransactionClient, orderId: string): Promise<boolean> {
    const freshItemCount = await tx.orderItem.count({
      where: { orderId, sku: { product: { internalTag: 'fresh_seafood_catalog' } } }
    });
    return freshItemCount > 0;
  }

  // Phase 2.51B：判断订单是否为**旧鲜鱼预订单**（支付硬拦截只针对旧 preorder，不再拦"含 fresh 内容"的新直购订单）。
  // 判据：该 order 存在 FreshPreorderDetail 行，或存在带 orderMode=FRESH_PREORDER 标记的 OrderNote。
  // 新 fresh 直购订单不建 FreshPreorderDetail、不写该 note → 不被拦截；旧样本(FP-…)仍被拦截。
  private async isLegacyFreshPreorderOrder(tx: Prisma.TransactionClient, orderId: string): Promise<boolean> {
    const detailCount = await tx.freshPreorderDetail.count({ where: { orderId } });
    if (detailCount > 0) return true;
    const noteCount = await tx.orderNote.count({
      where: { orderId, body: { contains: '"orderMode":"FRESH_PREORDER"' } }
    });
    return noteCount > 0;
  }

  async markPaid(orderId: string, paymentRef: string, paidAmountCents: number, actor: RequestActor = ADMIN_ACTOR) {
    return this.repo.tx(async (tx) => {
      await this.repo.lockOrder(tx, orderId);

      const order = await this.repo.getOrder(tx, orderId);
      if (!order) throw new NotFoundException('Order not found');
      this.assertOrderAccess(order, actor);

      // Phase 2.48K / 2.51B：鲜鱼**旧预订单**支付硬拦截 —— 仅拦旧 preorder（有 FreshPreorderDetail/预订 note），
      // 新鲜鱼直购普通订单不再被拦。旧 preorder 仍禁止在线支付、不建 PaymentRecord、不改库存。
      if (await this.isLegacyFreshPreorderOrder(tx, orderId)) {
        throw new BadRequestException('鲜鱼预订订单需门店确认后结算，不支持在线支付。');
      }

      const existingPayment = await this.repo.findPaymentByRef(tx, paymentRef);
      if (existingPayment) {
        if (existingPayment.orderId !== orderId) {
          throw new BadRequestException('Duplicate paymentRef used for a different order');
        }
        return { result: 'IGNORED_DUPLICATE' as const };
      }

      if (order.status !== 'PENDING_PAYMENT') {
        throw new BadRequestException('Invalid transition: payment only allowed from PENDING_PAYMENT');
      }

      if (order.totalAmountCents <= 0 || paidAmountCents <= 0 || paidAmountCents !== order.totalAmountCents) {
        console.warn('Wechat payment amount mismatch rejected', {
          orderId: maskTail(order.id, 6),
          expectedAmountCents: order.totalAmountCents,
          actualAmountCents: paidAmountCents,
          paymentRef: maskTail(paymentRef, 8)
        });

        throw new BadRequestException('Payment amount does not match order total');
      }

      const skuIds = order.items.map((i) => i.skuId);
      await this.repo.lockInventoriesForOrder(tx, order.storeId, skuIds);
      const inventories = await this.repo.getInventoriesForOrder(tx, order.storeId, skuIds);
      const bySku = new Map(inventories.map((i) => [i.skuId, i]));

      for (const item of order.items) {
        const inv = bySku.get(item.skuId);
        if (!inv) throw new BadRequestException(`Inventory missing for sku ${item.skuId}`);
        if (inv.availableStock < item.quantity) throw new BadRequestException('Insufficient available stock');
      }

      await this.repo.createPaymentRecord(tx, orderId, paymentRef, paidAmountCents);

      const inventoryLogs: Prisma.InventoryLogCreateManyInput[] = [];

      for (const item of order.items) {
        const inv = bySku.get(item.skuId)!;
        await this.repo.updateInventory(tx, inv.id, {
          availableStock: inv.availableStock - item.quantity,
          reservedStock: inv.reservedStock + item.quantity
        });
        inventoryLogs.push({
          inventoryId: inv.id,
          orderId,
          storeId: inv.storeId,
          skuId: inv.skuId,
          action: 'RESERVE_AFTER_PAYMENT',
          deltaAvailable: -item.quantity,
          deltaReserved: item.quantity,
          deltaPhysical: 0,
          oldAvailableStock: inv.availableStock,
          newAvailableStock: inv.availableStock - item.quantity,
          oldReservedStock: inv.reservedStock,
          newReservedStock: inv.reservedStock + item.quantity,
          oldPhysicalStock: inv.physicalStock,
          newPhysicalStock: inv.physicalStock,
          operatorAdminId: actor.adminId
        });
      }

      const toStatus = order.fulfillmentType === 'STORE_PICKUP' ? OrderStatus.PAID_PENDING_PREP : OrderStatus.PAID_PENDING_SHIPMENT;
      await this.repo.updateOrderStatus(tx, orderId, toStatus);
      await this.repo.insertOrderStatusLog(
        tx,
        orderId,
        order.status as OrderStatus,
        toStatus,
        `payment marked: ${paymentRef}`,
        this.getAdminLogOptions(actor, 'MARK_PAID')
      );
      await this.repo.insertInventoryLogs(tx, inventoryLogs);
      await this.coupons.useLockedCouponsForOrder(tx, orderId);
      await this.referrals.handleFirstPaidOrder(tx, order.customerId, orderId);

      return { result: 'APPLIED' as const };
    });
  }

  async createMiniappPayment(orderId: string, actor: RequestActor = ADMIN_ACTOR) {
    const order = await this.getOrder(orderId, actor);

    // Phase 2.48K-fix：鲜鱼预订单支付硬拦截。
    // 真实内容判定（与 markPaid 一致），不依赖 order.isFreshPreorder —— 该字段在 getOrder()/getOrderDetail()
    // 路径并不填充（仅 createFreshPreorder 返回值与 listOrders 映射里有），单靠它会形同虚设（2.48J 回归暴露）。
    // 命中时在调用微信 prepay client 之前直接拒绝：不创建支付单、不建 PaymentRecord、不改库存。
    // Phase 2.51B：仅拦**旧鲜鱼预订单**（FreshPreorderDetail/预订 note），不再拦"含 fresh 内容"的新直购订单。
    const isLegacyPreorder = await this.repo.tx((tx) => this.isLegacyFreshPreorderOrder(tx, orderId));
    if (isLegacyPreorder) {
      throw new BadRequestException('FRESH_PREORDER_PAYMENT_BLOCKED: 鲜鱼预订订单需门店确认后结算，不支持在线支付');
    }

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException('Miniapp payment creation only allowed from PENDING_PAYMENT');
    }

    const openId = this.getWechatOpenIdFromCustomerUserId(order.customerId);
    const paymentCreation = await this.wechatMiniappPaymentCreateClient.createMiniappPayment({
      orderNo: order.orderNo,
      totalAmountCents: order.totalAmountCents,
      openId
    });

    return {
      provider: 'wechat' as const,
      initiationType: 'MINIAPP' as const,
      orderId: order.id,
      orderNo: order.orderNo,
      totalAmountCents: order.totalAmountCents,
      launchParams: paymentCreation.launchParams
    };
  }

  async handleMiniappPaymentCallback(dto: MiniappPaymentCallbackDto, verificationInput: WechatCallbackSignatureVerificationInput) {
    const attempt = this.miniappPaymentCallbackVerification.buildVerificationAttempt(dto);
    const verifiedCallback = this.miniappPaymentCallbackVerification.verifyWechatCallbackSignature(
      attempt.callbackPayload,
      verificationInput
    );
    const extractedCallback = this.miniappPaymentCallbackVerification.extractWechatCallbackPayloadForBusinessMapping(
      verifiedCallback.callbackPayload
    );
    const businessInput = this.miniappPaymentCallbackVerification.mapVerifiedWechatCallbackToBusinessInput(extractedCallback);
    const order = await this.repo.findOrderByOrderNo(businessInput.orderNo);

    if (!order) {
      throw new NotFoundException('Order not found for verified callback orderNo');
    }

    const completion = await this.markPaid(order.id, businessInput.paymentRef, businessInput.paidAmountCents);

    if (completion.result !== 'APPLIED' && completion.result !== 'IGNORED_DUPLICATE') {
      throw new InternalServerErrorException('Unexpected verified callback completion result');
    }

    return {
      stage: 'CALLBACK_COMPLETION' as const,
      provider: verifiedCallback.provider,
      status: completion.result,
      orderId: order.id,
      orderNo: order.orderNo,
      paymentRef: businessInput.paymentRef,
      paidAmountCents: businessInput.paidAmountCents,
      message: completion.result === 'APPLIED' ? 'Verified callback payment applied' : 'Verified callback duplicate acknowledged'
    };
  }

  async cancelOrder(orderId: string, actor: RequestActor = ADMIN_ACTOR, reason?: string) {
    return this.repo.tx(async (tx) => {
      await this.repo.lockOrder(tx, orderId);
      const order = await this.repo.getOrder(tx, orderId);
      if (!order) throw new NotFoundException('Order not found');
      this.assertOrderAccess(order, actor);

      if (order.status === OrderStatus.CANCELLED) {
        return { result: 'ALREADY_CANCELLED' as const };
      }

      if (actor.role === UserRole.CUSTOMER && order.status !== OrderStatus.PENDING_PAYMENT) {
        throw new BadRequestException('仅待支付订单可以由顾客取消。');
      }

      const cancellable: OrderStatus[] = [
        OrderStatus.PENDING_PAYMENT,
        OrderStatus.PAID_PENDING_PREP,
        OrderStatus.PAID_PENDING_SHIPMENT,
        OrderStatus.READY_FOR_PICKUP
      ];
      if (!cancellable.includes(order.status)) throw new BadRequestException('Invalid transition: order cannot be cancelled');

      const skuIds = order.items.map((i) => i.skuId);
      await this.repo.lockInventoriesForOrder(tx, order.storeId, skuIds);
      const inventories = await this.repo.getInventoriesForOrder(tx, order.storeId, skuIds);
      const bySku = new Map(inventories.map((i) => [i.skuId, i]));

      const shouldRollback = order.status !== OrderStatus.PENDING_PAYMENT;
      if (shouldRollback) {
        for (const item of order.items) {
          const inv = bySku.get(item.skuId);
          if (!inv) throw new BadRequestException(`Inventory missing for sku ${item.skuId}`);
          if (inv.reservedStock < item.quantity) throw new BadRequestException('Reserved stock underflow');
        }
      }

      const logs: Prisma.InventoryLogCreateManyInput[] = [];

      if (shouldRollback) {
        for (const item of order.items) {
          const inv = bySku.get(item.skuId)!;
          await this.repo.updateInventory(tx, inv.id, {
            availableStock: inv.availableStock + item.quantity,
            reservedStock: inv.reservedStock - item.quantity
          });
          logs.push({
            inventoryId: inv.id,
            orderId,
            storeId: inv.storeId,
            skuId: inv.skuId,
            action: 'ROLLBACK_ON_CANCEL',
            deltaAvailable: item.quantity,
            deltaReserved: -item.quantity,
            deltaPhysical: 0,
            oldAvailableStock: inv.availableStock,
            newAvailableStock: inv.availableStock + item.quantity,
            oldReservedStock: inv.reservedStock,
            newReservedStock: inv.reservedStock - item.quantity,
            oldPhysicalStock: inv.physicalStock,
            newPhysicalStock: inv.physicalStock,
            operatorAdminId: actor.adminId
          });
        }
      }

      await this.repo.updateOrderStatus(tx, orderId, OrderStatus.CANCELLED);
      await this.repo.insertOrderStatusLog(
        tx,
        orderId,
        order.status as OrderStatus,
        OrderStatus.CANCELLED,
        reason?.trim() || 'cancelled by user/admin',
        this.getAdminLogOptions(actor, 'CANCEL_ORDER')
      );
      await this.repo.insertInventoryLogs(tx, logs);
      await this.coupons.releaseLockedCouponsForOrder(tx, orderId);
      return { result: 'CANCELLED' as const };
    });
  }

  async previewReorder(orderId: string, actor: RequestActor = ADMIN_ACTOR) {
    return this.repo.tx(async (tx) => {
      if (actor.role === UserRole.CUSTOMER && actor.userId) {
        await this.expirePendingOrdersForCustomerIfNeeded(actor.userId, tx);
      }

      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          store: true,
          items: {
            include: {
              sku: {
                include: {
                  product: true,
                  memberPrices: {
                    where: { isActive: true }
                  }
                }
              }
            }
          }
        }
      });

      if (!order) throw new NotFoundException('Order not found');
      this.assertOrderAccess(order, actor);

      const skuIds = order.items.map((item) => item.skuId);
      const [availabilityRows, inventories, memberLevel] = await Promise.all([
        tx.storeSkuAvailability.findMany({
          where: {
            storeId: order.storeId,
            skuId: { in: skuIds },
            isEnabled: true
          },
          select: { skuId: true }
        }),
        tx.inventory.findMany({
          where: {
            storeId: order.storeId,
            skuId: { in: skuIds }
          },
          select: {
            skuId: true,
            availableStock: true
          }
        }),
        this.members.getMemberLevel(order.customerId, tx)
      ]);

      const availableSkuIds = new Set(availabilityRows.map((row) => row.skuId));
      const stockBySku = new Map(inventories.map((inventory) => [inventory.skuId, Math.max(0, inventory.availableStock)]));
      const purchasableItems: Array<{
        orderItemId: string;
        productId: string;
        productName: string;
        skuId: string;
        skuName: string;
        quantity: number;
        unitPriceCents: number;
        lineAmountCents: number;
        availableStock: number;
      }> = [];
      const unavailableItems: Array<{
        orderItemId: string;
        productName: string;
        skuName: string;
        quantity: number;
        reason: string;
      }> = [];

      for (const item of order.items) {
        const productName = item.sku.product?.name || '原订单商品';
        const skuName = item.sku.name || '原规格';
        const availableStock = stockBySku.get(item.skuId) || 0;
        let reason = '';

        if (!item.sku.product?.isPublished) {
          reason = '商品已下架。';
        } else if (!item.sku.isActive) {
          reason = '该规格已停售。';
        } else if (order.fulfillmentType === 'STORE_PICKUP' && !item.sku.product.supportsPickup) {
          reason = '当前商品暂不支持到店自提。';
        } else if (order.fulfillmentType === 'SHIPPING' && !item.sku.product.supportsShipping) {
          reason = '当前商品暂不支持邮寄发货。';
        } else if (!order.store.isActive) {
          reason = '原服务门店暂不可用，请重新选择门店。';
        } else if (!availableSkuIds.has(item.skuId)) {
          reason = '当前门店暂不可售。';
        } else if (availableStock < item.quantity) {
          reason = `当前库存不足，仅剩 ${availableStock} 件。`;
        }

        if (reason) {
          unavailableItems.push({
            orderItemId: item.id,
            productName,
            skuName,
            quantity: item.quantity,
            reason
          });
          continue;
        }

        const memberPrice = item.sku.memberPrices.find((price) => price.memberLevel === memberLevel);
        const unitPriceCents = memberPrice?.priceCents
          ? Math.min(item.sku.priceCents, memberPrice.priceCents)
          : item.sku.priceCents;

        purchasableItems.push({
          orderItemId: item.id,
          productId: item.sku.product.id,
          productName,
          skuId: item.sku.id,
          skuName,
          quantity: item.quantity,
          unitPriceCents,
          lineAmountCents: unitPriceCents * item.quantity,
          availableStock
        });
      }

      return {
        orderId: order.id,
        orderNo: order.orderNo,
        fulfillmentType: order.fulfillmentType,
        store: {
          id: order.store.id,
          name: order.store.name,
          address: order.store.address
        },
        purchasableItems,
        unavailableItems,
        suggestedAction: purchasableItems.length > 0 ? 'ADD_TO_CART' : 'NONE',
        message: purchasableItems.length === order.items.length
          ? '已为你找到原订单商品，是否再来一单？'
          : purchasableItems.length > 0
            ? '部分商品暂不可购买，已为你保留可购买商品。'
            : '原订单商品当前暂不可购买，可以返回商品列表重新选择。'
      };
    });
  }

  async markReadyForPickup(orderId: string, actor: RequestActor = ADMIN_ACTOR) {
    return this.repo.tx(async (tx) => {
      await this.repo.lockOrder(tx, orderId);
      const order = await this.repo.getOrder(tx, orderId);
      if (!order) throw new NotFoundException('Order not found');
      this.assertOrderAccess(order, actor);
      if (order.fulfillmentType !== 'STORE_PICKUP' || order.status !== OrderStatus.PAID_PENDING_PREP) {
        throw new BadRequestException('Invalid transition: ready for pickup');
      }

      await this.repo.updateOrderStatus(tx, orderId, OrderStatus.READY_FOR_PICKUP);
      await this.repo.insertOrderStatusLog(
        tx,
        orderId,
        order.status as OrderStatus,
        OrderStatus.READY_FOR_PICKUP,
        'store prepared',
        this.getAdminLogOptions(actor, 'READY_FOR_PICKUP')
      );
      return { result: 'READY_FOR_PICKUP' as const };
    });
  }

  async completePickup(orderId: string, pickupCode: string, actor: RequestActor = ADMIN_ACTOR) {
    return this.repo.tx(async (tx) => {
      await this.repo.lockOrder(tx, orderId);
      const order = await this.repo.getOrder(tx, orderId);
      if (!order) throw new NotFoundException('Order not found');
      this.assertOrderAccess(order, actor);
      if (order.fulfillmentType !== 'STORE_PICKUP' || order.status !== OrderStatus.READY_FOR_PICKUP) {
        throw new BadRequestException('Invalid transition: complete pickup');
      }

      const pickupRecord = await tx.pickupRecord.findUnique({ where: { orderId } });
      if (!pickupRecord || pickupRecord.pickupCode !== pickupCode) {
        throw new BadRequestException('Invalid pickup code');
      }
      if (pickupRecord.pickedUpAt) {
        throw new BadRequestException('Pickup already completed');
      }

      const skuIds = order.items.map((i) => i.skuId);
      await this.repo.lockInventoriesForOrder(tx, order.storeId, skuIds);
      const inventories = await this.repo.getInventoriesForOrder(tx, order.storeId, skuIds);
      const bySku = new Map(inventories.map((i) => [i.skuId, i]));

      for (const item of order.items) {
        const inv = bySku.get(item.skuId);
        if (!inv) throw new BadRequestException(`Inventory missing for sku ${item.skuId}`);
        if (inv.reservedStock < item.quantity || inv.physicalStock < item.quantity) {
          throw new BadRequestException('Stock underflow on pickup');
        }
      }

      const logs: Prisma.InventoryLogCreateManyInput[] = [];

      for (const item of order.items) {
        const inv = bySku.get(item.skuId)!;
        await this.repo.updateInventory(tx, inv.id, {
          reservedStock: inv.reservedStock - item.quantity,
          physicalStock: inv.physicalStock - item.quantity
        });

        logs.push({
          inventoryId: inv.id,
          orderId,
          storeId: inv.storeId,
          skuId: inv.skuId,
          action: 'DEDUCT_ON_PICKUP_COMPLETE',
          deltaAvailable: 0,
          deltaReserved: -item.quantity,
          deltaPhysical: -item.quantity,
          oldAvailableStock: inv.availableStock,
          newAvailableStock: inv.availableStock,
          oldReservedStock: inv.reservedStock,
          newReservedStock: inv.reservedStock - item.quantity,
          oldPhysicalStock: inv.physicalStock,
          newPhysicalStock: inv.physicalStock - item.quantity,
          operatorAdminId: actor.adminId
        });
      }

      await tx.pickupRecord.update({ where: { orderId }, data: { pickedUpAt: new Date() } });
      await this.repo.updateOrderStatus(tx, orderId, OrderStatus.COMPLETED);
      await this.repo.insertOrderStatusLog(
        tx,
        orderId,
        order.status as OrderStatus,
        OrderStatus.COMPLETED,
        'pickup completed',
        this.getAdminLogOptions(actor, 'COMPLETE_PICKUP')
      );
      await this.repo.insertInventoryLogs(tx, logs);
      return { result: 'COMPLETED' as const };
    });
  }

  async shipOrder(orderId: string, courierCompany: string, trackingNumber: string, actor: RequestActor = ADMIN_ACTOR, shippingNote?: string) {
    return this.repo.tx(async (tx) => {
      await this.repo.lockOrder(tx, orderId);
      const order = await this.repo.getOrder(tx, orderId);
      if (!order) throw new NotFoundException('Order not found');
      this.assertOrderAccess(order, actor);
      if (order.fulfillmentType !== 'SHIPPING' || order.status !== OrderStatus.PAID_PENDING_SHIPMENT) {
        throw new BadRequestException('Invalid transition: ship order');
      }

      const skuIds = order.items.map((i) => i.skuId);
      await this.repo.lockInventoriesForOrder(tx, order.storeId, skuIds);
      const inventories = await this.repo.getInventoriesForOrder(tx, order.storeId, skuIds);
      const bySku = new Map(inventories.map((i) => [i.skuId, i]));

      for (const item of order.items) {
        const inv = bySku.get(item.skuId);
        if (!inv) throw new BadRequestException(`Inventory missing for sku ${item.skuId}`);
        if (inv.reservedStock < item.quantity || inv.physicalStock < item.quantity) {
          throw new BadRequestException('Stock underflow on shipment');
        }
      }

      const logs: Prisma.InventoryLogCreateManyInput[] = [];

      for (const item of order.items) {
        const inv = bySku.get(item.skuId)!;
        await this.repo.updateInventory(tx, inv.id, {
          reservedStock: inv.reservedStock - item.quantity,
          physicalStock: inv.physicalStock - item.quantity
        });

        logs.push({
          inventoryId: inv.id,
          orderId,
          storeId: inv.storeId,
          skuId: inv.skuId,
          action: 'DEDUCT_ON_SHIPPED',
          deltaAvailable: 0,
          deltaReserved: -item.quantity,
          deltaPhysical: -item.quantity,
          oldAvailableStock: inv.availableStock,
          newAvailableStock: inv.availableStock,
          oldReservedStock: inv.reservedStock,
          newReservedStock: inv.reservedStock - item.quantity,
          oldPhysicalStock: inv.physicalStock,
          newPhysicalStock: inv.physicalStock - item.quantity,
          operatorAdminId: actor.adminId
        });
      }

      await this.repo.createShipment(tx, orderId, courierCompany, trackingNumber);
      await this.repo.updateOrderStatus(tx, orderId, OrderStatus.SHIPPED);
      await this.repo.insertOrderStatusLog(
        tx,
        orderId,
        order.status as OrderStatus,
        OrderStatus.SHIPPED,
        shippingNote?.trim() ? `已发货：${shippingNote.trim()}` : 'shipment created and shipped',
        this.getAdminLogOptions(actor, 'SHIP_ORDER')
      );
      await this.repo.insertInventoryLogs(tx, logs);
      return { result: 'SHIPPED' as const };
    });
  }

  async markDelivered(orderId: string, actor: RequestActor = ADMIN_ACTOR) {
    return this.repo.tx(async (tx) => {
      await this.repo.lockOrder(tx, orderId);
      const order = await this.repo.getOrder(tx, orderId);
      if (!order) throw new NotFoundException('Order not found');
      this.assertOrderAccess(order, actor);
      if (order.fulfillmentType !== 'SHIPPING' || order.status !== OrderStatus.SHIPPED) {
        throw new BadRequestException('Invalid transition: deliver order');
      }

      await this.repo.markDelivered(tx, orderId);
      await this.repo.updateOrderStatus(tx, orderId, OrderStatus.DELIVERED);
      await this.repo.insertOrderStatusLog(
        tx,
        orderId,
        order.status as OrderStatus,
        OrderStatus.DELIVERED,
        'shipping delivered',
        this.getAdminLogOptions(actor, 'DELIVER_ORDER')
      );
      return { result: 'DELIVERED' as const };
    });
  }

  async getOrder(orderId: string, actor: RequestActor = ADMIN_ACTOR) {
    if (actor.role === UserRole.CUSTOMER && actor.userId) {
      await this.expirePendingOrdersForCustomerIfNeeded(actor.userId);
    }

    const order = await this.repo.getOrderDetail(orderId);
    if (!order) throw new NotFoundException('Order not found');
    this.assertOrderAccess(order, actor);

    // Phase 2.49D / 2.51B：isFreshPreorder 现表示"**旧鲜鱼预订单**"——以 FreshPreorderDetail 明细存在判定，
    // 而非"含 fresh 内容"。这样新鲜鱼**直购**普通订单不会被标为预订（前台显示去支付、后台不显示预订流程），
    // 旧样本(有 FreshPreorderDetail)仍标为预订。供后台/前台预订相关展示使用。
    const isFreshPreorder = !!(order as any).freshPreorderDetail;
    // Phase 2.49H：派生鲜鱼预订 stage 文案（供后台显示），明细随 include 返回。
    const stageMeta = this.freshStageMeta((order as any).freshPreorderDetail?.stage);

    // Phase 2.40B：顾客端订单详情共用此查询。statusLog 的 reason（含发货备注/取消原因）与 operatorAdmin（操作人）
    // 属内部信息，顾客不可见 → 对 CUSTOMER 净化 statusLogs，只保留状态与时间。Admin 保留完整。
    if (actor.role === UserRole.CUSTOMER) {
      const sanitizedLogs = (order.statusLogs ?? []).map((log) => ({
        id: log.id,
        orderId: log.orderId,
        fromStatus: log.fromStatus,
        toStatus: log.toStatus,
        action: null,
        reason: null,
        operatorAdminId: null,
        createdAt: log.createdAt
      }));
      // Phase 2.49H：顾客端不暴露门店内部备注/操作人/内部时间戳，仅保留金额与重量等结算相关字段。
      const fd = (order as any).freshPreorderDetail;
      const customerFreshDetail = fd
        ? {
            stage: fd.stage,
            estimatedTotalCents: fd.estimatedTotalCents,
            actualWeightJin: fd.actualWeightJin,
            actualUnitPriceCents: fd.actualUnitPriceCents,
            finalTotalCents: fd.finalTotalCents
          }
        : null;
      return {
        ...order,
        isFreshPreorder,
        freshPreorderDetail: customerFreshDetail,
        freshPreorderStageLabel: stageMeta.label,
        freshPreorderActionHint: stageMeta.actionHint,
        statusLogs: sanitizedLogs
      };
    }

    return {
      ...order,
      isFreshPreorder,
      freshPreorderStageLabel: stageMeta.label,
      freshPreorderActionHint: stageMeta.actionHint
    };
  }

  // Phase 2.49H：鲜鱼预订 stage → 后台展示文案（纯派生，不写 DB）。
  private freshStageMeta(stage?: string | null): { label: string; actionHint: string } {
    switch (stage) {
      case 'PENDING_STORE_CONFIRMATION':
        return { label: '待门店称重确认', actionHint: '门店确认有货后填写实际重量与最终价；该订单不在线支付。' };
      case 'CONFIRMED_WAITING_PICKUP':
        return { label: '已确认 · 待取货/线下结算', actionHint: '等待顾客到店称重取货并线下结算后点击完成。' };
      case 'COMPLETED_OFFLINE_SETTLED':
        return { label: '已完成 · 线下结算', actionHint: '鲜鱼预订已线下结算完成，无需继续处理。' };
      case 'CANCELLED':
        return { label: '已取消', actionHint: '鲜鱼预订已取消。' };
      default:
        return { label: '鲜鱼预订', actionHint: '鲜鱼预订单，以门店称重确认为准，不在线支付。' };
    }
  }

  async listOrders(actor: RequestActor = ADMIN_ACTOR) {
    if (actor.role === UserRole.CUSTOMER && actor.userId) {
      await this.expirePendingOrdersForCustomerIfNeeded(actor.userId);
    }

    const orders = await this.repo.listOrders({
      customerId: this.getScopedCustomerId(actor),
      storeId: this.getScopedStoreId(actor)
    });
    // Phase 2.48J / 2.51B：isFreshPreorder 表示"旧鲜鱼预订单"（以 FreshPreorderDetail 明细存在判定），
    // 新鲜鱼直购普通订单不再被标记（前端显示去支付、后台按普通订单处理）。
    // Phase 2.49H：附 stage 文案，供后台列表按 stage 展示（明细随 include 返回）。
    return orders.map((order) => {
      const stageMeta = this.freshStageMeta((order as any).freshPreorderDetail?.stage);
      return {
        ...order,
        isFreshPreorder: !!(order as any).freshPreorderDetail,
        freshPreorderStageLabel: stageMeta.label,
        freshPreorderActionHint: stageMeta.actionHint
      };
    });
  }

  // Phase 2.49H：鲜鱼预订正向处理动作（confirm/complete/cancel）。
  // 共同：仅 ADMIN/STORE_STAFF（由 controller guard 保证）；仅鲜鱼预订单；以 FreshPreorderDetail.stage 为主状态，
  // 不改 Order.status、不触发支付、不建 PaymentRecord、不改商品/库存；支持 dryRun（只返回 wouldChange，不写库）。
  private async loadFreshPreorderContext(tx: Prisma.TransactionClient, orderId: string) {
    const order = await this.repo.getOrder(tx, orderId);
    if (!order) throw new NotFoundException('Order not found');
    const isFresh = await this.isFreshPreorderOrder(tx, orderId);
    if (!isFresh) throw new BadRequestException('FRESH_PREORDER_ONLY: 仅鲜鱼预订单可执行此动作');
    const detail = await tx.freshPreorderDetail.findUnique({ where: { orderId } });
    if (!detail) throw new BadRequestException('FRESH_PREORDER_DETAIL_MISSING: 鲜鱼预订明细不存在');
    return { order, detail };
  }

  private async recordFreshAuditTx(
    tx: Prisma.TransactionClient,
    actor: RequestActor,
    action: string,
    orderId: string,
    orderNo: string,
    metadata: Record<string, unknown>
  ) {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(metadata)) {
      if (v === undefined) continue;
      clean[k] = typeof v === 'string' && v.length > 200 ? `${v.slice(0, 200)}…` : v;
    }
    await tx.adminAuditLog.create({
      data: {
        adminId: actor.adminId,
        action,
        entityType: 'Order',
        entityId: orderId,
        entityLabel: orderNo,
        summary: `鲜鱼预订${action}`,
        metadataJson: JSON.stringify(clean)
      }
    });
  }

  async confirmFreshPreorder(
    orderId: string,
    actor: RequestActor,
    input: { actualWeightJin: number; actualUnitPriceCents?: number; finalTotalCents?: number; storeConfirmNote?: string; customerContactNote?: string },
    dryRun = false
  ) {
    if (!(input.actualWeightJin > 0)) throw new BadRequestException('actualWeightJin 必须 > 0');
    if (Math.round(input.actualWeightJin * 100) !== input.actualWeightJin * 100) {
      throw new BadRequestException('actualWeightJin 最多两位小数');
    }
    if (input.actualUnitPriceCents == null && input.finalTotalCents == null) {
      throw new BadRequestException('actualUnitPriceCents 或 finalTotalCents 至少提供一个');
    }
    const finalTotalCents =
      input.finalTotalCents != null
        ? input.finalTotalCents
        : Math.round(input.actualWeightJin * (input.actualUnitPriceCents as number));
    if (!(finalTotalCents > 0)) throw new BadRequestException('最终总价必须 > 0');

    return this.repo.tx(async (tx) => {
      await this.repo.lockOrder(tx, orderId);
      const { order, detail } = await this.loadFreshPreorderContext(tx, orderId);
      if (detail.stage !== 'PENDING_STORE_CONFIRMATION') {
        throw new BadRequestException(`仅 PENDING_STORE_CONFIRMATION 可确认，当前=${detail.stage}`);
      }
      const wouldChange = {
        stage: { from: detail.stage, to: 'CONFIRMED_WAITING_PICKUP' },
        actualWeightJin: input.actualWeightJin,
        actualUnitPriceCents: input.actualUnitPriceCents ?? null,
        finalTotalCents
      };
      if (dryRun) return { dryRun: true as const, result: 'WOULD_CONFIRM' as const, wouldChange };

      await tx.freshPreorderDetail.update({
        where: { orderId },
        data: {
          stage: 'CONFIRMED_WAITING_PICKUP',
          actualWeightJin: new Prisma.Decimal(input.actualWeightJin),
          actualUnitPriceCents: input.actualUnitPriceCents ?? null,
          finalTotalCents,
          storeConfirmNote: input.storeConfirmNote ?? null,
          customerContactNote: input.customerContactNote ?? null,
          confirmedByAdminUserId: actor.adminId ?? null,
          confirmedAt: new Date()
        }
      });
      await this.recordFreshAuditTx(tx, actor, 'FRESH_PREORDER_CONFIRM', orderId, order.orderNo, {
        oldStage: 'PENDING_STORE_CONFIRMATION',
        newStage: 'CONFIRMED_WAITING_PICKUP',
        actualWeightJin: input.actualWeightJin,
        actualUnitPriceCents: input.actualUnitPriceCents ?? null,
        finalTotalCents,
        hasStoreNote: !!input.storeConfirmNote,
        hasContactNote: !!input.customerContactNote
      });
      return { result: 'CONFIRMED' as const, stage: 'CONFIRMED_WAITING_PICKUP' as const, finalTotalCents };
    });
  }

  async completeFreshPreorder(orderId: string, actor: RequestActor, dryRun = false) {
    return this.repo.tx(async (tx) => {
      await this.repo.lockOrder(tx, orderId);
      const { order, detail } = await this.loadFreshPreorderContext(tx, orderId);
      if (detail.stage !== 'CONFIRMED_WAITING_PICKUP') {
        throw new BadRequestException(`仅 CONFIRMED_WAITING_PICKUP 可完成，当前=${detail.stage}`);
      }
      const wouldChange = { stage: { from: detail.stage, to: 'COMPLETED_OFFLINE_SETTLED' } };
      if (dryRun) return { dryRun: true as const, result: 'WOULD_COMPLETE' as const, wouldChange };

      await tx.freshPreorderDetail.update({
        where: { orderId },
        data: { stage: 'COMPLETED_OFFLINE_SETTLED', completedAt: new Date() }
      });
      await this.recordFreshAuditTx(tx, actor, 'FRESH_PREORDER_COMPLETE', orderId, order.orderNo, {
        oldStage: 'CONFIRMED_WAITING_PICKUP',
        newStage: 'COMPLETED_OFFLINE_SETTLED'
      });
      return { result: 'COMPLETED' as const, stage: 'COMPLETED_OFFLINE_SETTLED' as const };
    });
  }

  async cancelFreshPreorder(orderId: string, actor: RequestActor, cancelReason: string, dryRun = false) {
    if (!cancelReason || !cancelReason.trim()) throw new BadRequestException('cancelReason 必填');
    return this.repo.tx(async (tx) => {
      await this.repo.lockOrder(tx, orderId);
      const { order, detail } = await this.loadFreshPreorderContext(tx, orderId);
      const cancellable = ['PENDING_STORE_CONFIRMATION', 'CONFIRMED_WAITING_PICKUP'];
      if (!cancellable.includes(detail.stage)) {
        throw new BadRequestException(`仅 ${cancellable.join('/')} 可取消，当前=${detail.stage}`);
      }
      const wouldChange = { stage: { from: detail.stage, to: 'CANCELLED' } };
      if (dryRun) return { dryRun: true as const, result: 'WOULD_CANCEL' as const, wouldChange };

      await tx.freshPreorderDetail.update({
        where: { orderId },
        data: { stage: 'CANCELLED', cancelReason: cancelReason.trim(), cancelledAt: new Date() }
      });
      await this.recordFreshAuditTx(tx, actor, 'FRESH_PREORDER_CANCEL', orderId, order.orderNo, {
        oldStage: detail.stage,
        newStage: 'CANCELLED',
        hasReason: true
      });
      return { result: 'CANCELLED' as const, stage: 'CANCELLED' as const };
    });
  }

  async getOrderStatusLogs(orderId: string, actor: RequestActor = ADMIN_ACTOR) {
    await this.getOrder(orderId, actor);
    return this.repo.getStatusLogs(orderId);
  }

  // Phase 2.40B：订单内部备注（仅后台）。
  async listOrderNotes(orderId: string) {
    const order = await this.repo.findOrderById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    return this.repo.listOrderNotes(orderId);
  }

  async addOrderNote(orderId: string, body: string, type: string, operatorAdminId?: string) {
    const trimmed = (body || '').trim();
    if (!trimmed) throw new BadRequestException('备注内容不能为空');
    const order = await this.repo.findOrderById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    return this.repo.createOrderNote(orderId, trimmed, (type || 'internal').trim() || 'internal', operatorAdminId);
  }

  // Phase 2.40C：软删除/撤回订单备注（不硬删；幂等）。
  async softDeleteOrderNote(orderId: string, noteId: string, operatorAdminId?: string, deleteReason?: string) {
    const note = await this.repo.findOrderNoteById(noteId);
    if (!note || note.orderId !== orderId) throw new NotFoundException('Order note not found');
    if (note.deletedAt) {
      return { result: 'ALREADY_DELETED' as const, note };
    }
    const updated = await this.repo.softDeleteOrderNote(noteId, operatorAdminId, deleteReason?.trim() || undefined);
    return { result: 'DELETED' as const, note: updated };
  }
}
