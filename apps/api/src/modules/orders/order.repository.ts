import { Injectable } from '@nestjs/common';
import { Prisma, OrderStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async tx<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) => fn(tx), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
  }

  async createPaymentRecord(tx: Prisma.TransactionClient, orderId: string, paymentRef: string, paidAmountCents: number) {
    return tx.paymentRecord.create({
      data: { orderId, paymentRef, paidAmountCents }
    });
  }

  async findPaymentByRef(tx: Prisma.TransactionClient, paymentRef: string) {
    return tx.paymentRecord.findUnique({ where: { paymentRef } });
  }

  async findStore(tx: Prisma.TransactionClient, storeId: string) {
    return tx.store.findUnique({ where: { id: storeId } });
  }

  async findSkus(tx: Prisma.TransactionClient, skuIds: string[]) {
    return tx.sku.findMany({
      where: { id: { in: skuIds } },
      include: { product: true, memberPrices: true }
    });
  }

  async findAvailability(tx: Prisma.TransactionClient, storeId: string, skuIds: string[]) {
    return tx.storeSkuAvailability.findMany({
      where: {
        storeId,
        skuId: { in: skuIds },
        isEnabled: true
      }
    });
  }

  async createOrder(tx: Prisma.TransactionClient, data: Prisma.OrderCreateInput) {
    return tx.order.create({
      data,
      include: { items: true, shippingAddress: true, pickupRecord: true, couponApplications: true }
    });
  }

  async lockOrder(tx: Prisma.TransactionClient, orderId: string) {
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
  }

  async getOrder(tx: Prisma.TransactionClient, orderId: string) {
    return tx.order.findUnique({
      where: { id: orderId },
      include: { items: true, couponApplications: true }
    });
  }

  async listOrders(filter?: { customerId?: string; storeId?: string }) {
    return this.prisma.order.findMany({
      where: {
        customerId: filter?.customerId,
        storeId: filter?.storeId
      },
      include: {
        store: true,
        items: {
          include: {
            sku: {
              include: { product: true }
            }
          }
        },
        shipment: true,
        pickupRecord: true,
        shippingAddress: true,
        // Phase 2.49H：鲜鱼预订明细（1:1），供后台列表按 stage 展示。
        freshPreorderDetail: true,
        couponApplications: {
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getOrderDetail(orderId: string) {
    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        store: true,
        items: {
          include: {
            sku: {
              include: { product: true }
            }
          }
        },
        shipment: true,
        pickupRecord: true,
        shippingAddress: true,
        // Phase 2.49H：鲜鱼预订明细（1:1），供后台详情显示与正向动作判定。
        freshPreorderDetail: true,
        // Phase 2.40B：附操作人，供后台时间线显示操作人姓名。
        statusLogs: {
          orderBy: { createdAt: 'asc' },
          include: { operatorAdmin: { select: { id: true, username: true, displayName: true } } }
        },
        couponApplications: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });
  }

  async findOrderByOrderNo(orderNo: string) {
    return this.prisma.order.findUnique({
      where: { orderNo },
      select: { id: true, orderNo: true }
    });
  }

  async getStatusLogs(orderId: string) {
    return this.prisma.orderStatusLog.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
      // Phase 2.40B：附操作人，供后台时间线显示操作人姓名。
      include: { operatorAdmin: { select: { id: true, username: true, displayName: true } } }
    });
  }

  // Phase 2.40B：订单内部备注（仅后台）。
  async createOrderNote(orderId: string, body: string, type: string, authorAdminId?: string) {
    return this.prisma.orderNote.create({
      data: { orderId, body, type, visibility: 'internal', authorAdminId }
    });
  }

  async listOrderNotes(orderId: string) {
    return this.prisma.orderNote.findMany({
      // Phase 2.40C：默认只返回未撤回（deletedAt=null）的备注。
      where: { orderId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { id: true, username: true, displayName: true } } }
    });
  }

  async findOrderById(orderId: string) {
    return this.prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });
  }

  // Phase 2.40C：取单条备注（校验归属用）。
  async findOrderNoteById(noteId: string) {
    return this.prisma.orderNote.findUnique({ where: { id: noteId } });
  }

  // Phase 2.40C：软删除/撤回备注（不硬删）。
  async softDeleteOrderNote(noteId: string, deletedByAdminId?: string, deleteReason?: string) {
    return this.prisma.orderNote.update({
      where: { id: noteId },
      data: { deletedAt: new Date(), deletedByAdminId, deleteReason }
    });
  }

  async lockInventoriesForOrder(tx: Prisma.TransactionClient, storeId: string, skuIds: string[]) {
    if (skuIds.length === 0) return;

    await tx.$queryRaw`
      SELECT id
      FROM "Inventory"
      WHERE "storeId" = ${storeId}
        AND "skuId" IN (${Prisma.join(skuIds)})
      ORDER BY id
      FOR UPDATE
    `;
  }

  async getInventoriesForOrder(tx: Prisma.TransactionClient, storeId: string, skuIds: string[]) {
    return tx.inventory.findMany({
      where: { storeId, skuId: { in: skuIds } },
      orderBy: { id: 'asc' }
    });
  }

  async updateInventory(tx: Prisma.TransactionClient, inventoryId: string, data: Prisma.InventoryUpdateInput) {
    return tx.inventory.update({ where: { id: inventoryId }, data });
  }

  async insertInventoryLogs(tx: Prisma.TransactionClient, data: Prisma.InventoryLogCreateManyInput[]) {
    if (data.length === 0) return;
    await tx.inventoryLog.createMany({ data });
  }

  async insertOrderStatusLog(
    tx: Prisma.TransactionClient,
    orderId: string,
    fromStatus: OrderStatus | null,
    toStatus: OrderStatus,
    reason?: string,
    options?: { action?: string; operatorAdminId?: string }
  ) {
    await tx.orderStatusLog.create({
      data: {
        orderId,
        fromStatus,
        toStatus,
        reason,
        action: options?.action,
        operatorAdminId: options?.operatorAdminId
      }
    });
  }

  async updateOrderStatus(tx: Prisma.TransactionClient, orderId: string, status: OrderStatus) {
    return tx.order.update({ where: { id: orderId }, data: { status } });
  }

  async createShipment(tx: Prisma.TransactionClient, orderId: string, courierCompany: string, trackingNumber: string) {
    return tx.shipment.upsert({
      where: { orderId },
      update: { courierCompany, trackingNumber, shippedAt: new Date() },
      create: { orderId, courierCompany, trackingNumber, shippedAt: new Date() }
    });
  }

  async markDelivered(tx: Prisma.TransactionClient, orderId: string) {
    return tx.shipment.update({
      where: { orderId },
      data: { deliveredAt: new Date() }
    });
  }
}
