import { Body, Controller, Get, Headers, HttpCode, InternalServerErrorException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import type { Request } from 'express';
import { Roles } from '../../common/roles/roles.decorator';
import { UserRole } from '../../common/roles/role.enum';
import { RolesGuard } from '../../common/roles/roles.guard';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import type { AdminAuthIdentity, RequestWithAdmin } from '../admin-auth/admin-auth.types';
import { AdminRoles } from '../admin-auth/admin-role.decorator';
import { AdminRoleGuard } from '../admin-auth/admin-role.guard';
import { CustomerAuthArtifactGuard } from '../auth-exchange/customer-auth-artifact.guard';
import type { VerifiedCustomerAuthIdentity } from '../auth-exchange/customer-auth-artifact.service';
import { CancelOrderDto, CreateOrderDto, CompletePickupDto, CreateOrderNoteDto, FreshPreorderCancelDto, FreshPreorderCompleteDto, FreshPreorderConfirmDto, MarkPaidDto, MiniappPaymentCallbackDto, OrderQuotePreviewDto, ShipOrderDto } from './dto/order-workflow.dto';
import { OrderWorkflowService } from './order-workflow.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly workflow: OrderWorkflowService) {}

  private adminActor(admin: AdminAuthIdentity) {
    return {
      role: admin.role,
      adminId: admin.adminId,
      storeId: admin.storeId
    };
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  createOrder(@Headers('x-user-id') userId: string, @Body() dto: CreateOrderDto) {
    return this.workflow.createOrder(userId || 'anonymous-user', dto);
  }

  @Post('authenticated')
  @UseGuards(CustomerAuthArtifactGuard)
  createAuthenticatedOrder(@Req() req: { authenticatedCustomer: VerifiedCustomerAuthIdentity }, @Body() dto: CreateOrderDto) {
    return this.workflow.createOrder(req.authenticatedCustomer.userId, dto);
  }

  // Phase 2.48J：鲜鱼「提交预订」（fresh-only，写预订单，不触发支付）。
  @Post('fresh-preorder')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  createFreshPreorder(@Headers('x-user-id') userId: string, @Body() dto: { storeId?: string; items: Array<{ skuId: string; quantity: number }> }) {
    return this.workflow.createFreshPreorder(userId || 'anonymous-user', dto);
  }

  @Post('fresh-preorder/authenticated')
  @UseGuards(CustomerAuthArtifactGuard)
  createFreshPreorderAuthenticated(
    @Req() req: { authenticatedCustomer: VerifiedCustomerAuthIdentity },
    @Body() dto: { storeId?: string; items: Array<{ skuId: string; quantity: number }> }
  ) {
    return this.workflow.createFreshPreorder(req.authenticatedCustomer.userId, dto);
  }

  @Post('quote-preview')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  previewOrderQuote(@Body() dto: OrderQuotePreviewDto) {
    return this.workflow.previewOrderQuote(dto);
  }

  @Post('quote-preview/authenticated')
  @UseGuards(CustomerAuthArtifactGuard)
  previewAuthenticatedOrderQuote(@Req() req: { authenticatedCustomer: VerifiedCustomerAuthIdentity }, @Body() dto: OrderQuotePreviewDto) {
    return this.workflow.previewOrderQuote(dto, req.authenticatedCustomer.userId);
  }

  @Get()
  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.ADMIN, AdminRole.STORE_STAFF)
  listOrders(@Req() req: RequestWithAdmin) {
    return this.workflow.listOrders(this.adminActor(req.admin!));
  }

  @Get('authenticated')
  @UseGuards(CustomerAuthArtifactGuard)
  listAuthenticatedOrders(@Req() req: { authenticatedCustomer: VerifiedCustomerAuthIdentity }) {
    return this.workflow.listOrders({
      role: req.authenticatedCustomer.role,
      userId: req.authenticatedCustomer.userId
    });
  }

  @Post('miniapp-payment-callback')
  @HttpCode(200)
  async handleMiniappPaymentCallback(
    @Body() dto: MiniappPaymentCallbackDto,
    @Headers('wechatpay-timestamp') wechatpayTimestamp: string,
    @Headers('wechatpay-nonce') wechatpayNonce: string,
    @Headers('wechatpay-serial') wechatpaySerial: string,
    @Headers('wechatpay-signature') wechatpaySignature: string,
    @Req() req: Request & { rawBody?: Buffer }
  ) {
    const rawBody = req.rawBody?.toString('utf8') ?? '';
    const callbackDto = {
      ...dto,
      provider: dto.provider || 'wechat',
      callbackPayload: dto.callbackPayload ?? parseRawWechatCallbackPayload(rawBody)
    };
    const completion = await this.workflow.handleMiniappPaymentCallback(callbackDto, {
      rawBody,
      wechatpayTimestamp,
      wechatpayNonce,
      wechatpaySerial,
      wechatpaySignature
    });

    if (completion.status !== 'APPLIED' && completion.status !== 'IGNORED_DUPLICATE') {
      throw new InternalServerErrorException('Unexpected verified callback completion result');
    }

    return { acknowledged: true as const };
  }

  @Get(':id')
  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.ADMIN, AdminRole.STORE_STAFF)
  getOrder(@Param('id') id: string, @Req() req: RequestWithAdmin) {
    return this.workflow.getOrder(id, this.adminActor(req.admin!));
  }

  @Get(':id/authenticated')
  @UseGuards(CustomerAuthArtifactGuard)
  getAuthenticatedOrder(@Param('id') id: string, @Req() req: { authenticatedCustomer: VerifiedCustomerAuthIdentity }) {
    return this.workflow.getOrder(id, {
      role: req.authenticatedCustomer.role,
      userId: req.authenticatedCustomer.userId
    });
  }

  @Post(':id/reorder-preview/authenticated')
  @UseGuards(CustomerAuthArtifactGuard)
  previewAuthenticatedReorder(@Param('id') id: string, @Req() req: { authenticatedCustomer: VerifiedCustomerAuthIdentity }) {
    return this.workflow.previewReorder(id, {
      role: req.authenticatedCustomer.role,
      userId: req.authenticatedCustomer.userId
    });
  }

  @Get(':id/status-logs')
  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.ADMIN, AdminRole.STORE_STAFF)
  getStatusLogs(@Param('id') id: string, @Req() req: RequestWithAdmin) {
    return this.workflow.getOrderStatusLogs(id, this.adminActor(req.admin!));
  }

  // Phase 2.40B：订单内部备注（仅后台，admin 鉴权；顾客端无此接口）。
  @Get(':id/notes')
  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.ADMIN, AdminRole.STORE_STAFF)
  listNotes(@Param('id') id: string) {
    return this.workflow.listOrderNotes(id);
  }

  @Post(':id/notes')
  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.ADMIN, AdminRole.STORE_STAFF)
  addNote(@Param('id') id: string, @Body() body: CreateOrderNoteDto, @Req() req: RequestWithAdmin) {
    return this.workflow.addOrderNote(id, body.body, body.type || 'internal', req.admin!.adminId);
  }

  // Phase 2.40C：软删除/撤回内部备注（不硬删；仅 admin）。
  @Post(':orderId/notes/:noteId/delete')
  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.ADMIN, AdminRole.STORE_STAFF)
  softDeleteNote(@Param('orderId') orderId: string, @Param('noteId') noteId: string, @Req() req: RequestWithAdmin) {
    return this.workflow.softDeleteOrderNote(orderId, noteId, req.admin!.adminId);
  }

  @Post(':id/mark-paid')
  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.ADMIN)
  markPaid(@Param('id') id: string, @Body() body: MarkPaidDto, @Req() req: RequestWithAdmin) {
    return this.workflow.markPaid(id, body.paymentRef, body.paidAmountCents, this.adminActor(req.admin!));
  }

  @Post(':id/create-miniapp-payment')
  @UseGuards(CustomerAuthArtifactGuard)
  createMiniappPayment(@Param('id') id: string, @Req() req: { authenticatedCustomer: VerifiedCustomerAuthIdentity }) {
    return this.workflow.createMiniappPayment(id, {
      role: req.authenticatedCustomer.role,
      userId: req.authenticatedCustomer.userId
    });
  }

  @Post(':id/cancel')
  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.ADMIN)
  cancel(@Param('id') id: string, @Body() body: CancelOrderDto, @Req() req: RequestWithAdmin) {
    return this.workflow.cancelOrder(id, this.adminActor(req.admin!), body?.reason);
  }

  @Post(':id/cancel/authenticated')
  @UseGuards(CustomerAuthArtifactGuard)
  cancelAuthenticatedOrder(@Param('id') id: string, @Req() req: { authenticatedCustomer: VerifiedCustomerAuthIdentity }) {
    return this.workflow.cancelOrder(id, {
      role: req.authenticatedCustomer.role,
      userId: req.authenticatedCustomer.userId
    });
  }

  @Post(':id/ready-for-pickup')
  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.ADMIN, AdminRole.STORE_STAFF)
  readyForPickup(@Param('id') id: string, @Req() req: RequestWithAdmin) {
    return this.workflow.markReadyForPickup(id, this.adminActor(req.admin!));
  }

  @Post(':id/complete-pickup')
  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.ADMIN, AdminRole.STORE_STAFF)
  completePickup(@Param('id') id: string, @Body() body: CompletePickupDto, @Req() req: RequestWithAdmin) {
    return this.workflow.completePickup(id, body.pickupCode, this.adminActor(req.admin!));
  }

  @Post(':id/ship')
  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.ADMIN, AdminRole.STORE_STAFF)
  ship(@Param('id') id: string, @Body() body: ShipOrderDto, @Req() req: RequestWithAdmin) {
    return this.workflow.shipOrder(id, body.courierCompany, body.trackingNumber, this.adminActor(req.admin!), body.shippingNote);
  }

  @Post(':id/deliver')
  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.ADMIN, AdminRole.STORE_STAFF)
  deliver(@Param('id') id: string, @Req() req: RequestWithAdmin) {
    return this.workflow.markDelivered(id, this.adminActor(req.admin!));
  }

  // Phase 2.49H：鲜鱼预订正向处理动作（仅鲜鱼预订单；支持 dryRun；不触发支付）。
  @Post(':id/fresh-preorder/confirm')
  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.ADMIN, AdminRole.STORE_STAFF)
  confirmFreshPreorder(@Param('id') id: string, @Body() body: FreshPreorderConfirmDto, @Req() req: RequestWithAdmin) {
    return this.workflow.confirmFreshPreorder(
      id,
      this.adminActor(req.admin!),
      {
        actualWeightJin: body.actualWeightJin,
        actualUnitPriceCents: body.actualUnitPriceCents,
        finalTotalCents: body.finalTotalCents,
        storeConfirmNote: body.storeConfirmNote,
        customerContactNote: body.customerContactNote
      },
      body.dryRun === true
    );
  }

  @Post(':id/fresh-preorder/complete')
  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.ADMIN, AdminRole.STORE_STAFF)
  completeFreshPreorder(@Param('id') id: string, @Body() body: FreshPreorderCompleteDto, @Req() req: RequestWithAdmin) {
    return this.workflow.completeFreshPreorder(id, this.adminActor(req.admin!), body?.dryRun === true);
  }

  @Post(':id/fresh-preorder/cancel')
  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @AdminRoles(AdminRole.ADMIN, AdminRole.STORE_STAFF)
  cancelFreshPreorder(@Param('id') id: string, @Body() body: FreshPreorderCancelDto, @Req() req: RequestWithAdmin) {
    return this.workflow.cancelFreshPreorder(id, this.adminActor(req.admin!), body.cancelReason, body.dryRun === true);
  }
}

function parseRawWechatCallbackPayload(rawBody: string): Record<string, unknown> {
  if (!rawBody.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawBody) as unknown;
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}
