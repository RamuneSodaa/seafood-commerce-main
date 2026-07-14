import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { CustomerAuthArtifactGuard } from '../auth-exchange/customer-auth-artifact.guard';
import type { VerifiedCustomerAuthIdentity } from '../auth-exchange/customer-auth-artifact.service';
import { CartService } from './cart.service';
import { AddCartItemDto, ClearCartItemsDto, UpdateCartItemDto } from './dto/cart.dto';

@Controller('cart')
@UseGuards(CustomerAuthArtifactGuard)
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  getCart(@Req() req: { authenticatedCustomer: VerifiedCustomerAuthIdentity }) {
    return this.cart.getCart(req.authenticatedCustomer.userId);
  }

  @Post('items')
  addItem(@Req() req: { authenticatedCustomer: VerifiedCustomerAuthIdentity }, @Body() dto: AddCartItemDto) {
    return this.cart.addItem(req.authenticatedCustomer.userId, dto);
  }

  @Patch('items/:id')
  updateItem(
    @Req() req: { authenticatedCustomer: VerifiedCustomerAuthIdentity },
    @Param('id') id: string,
    @Body() dto: UpdateCartItemDto
  ) {
    return this.cart.updateItem(req.authenticatedCustomer.userId, id, dto);
  }

  @Delete('items/:id')
  removeItem(@Req() req: { authenticatedCustomer: VerifiedCustomerAuthIdentity }, @Param('id') id: string) {
    return this.cart.removeItem(req.authenticatedCustomer.userId, id);
  }

  @Post('clear-items')
  clearItems(@Req() req: { authenticatedCustomer: VerifiedCustomerAuthIdentity }, @Body() dto: ClearCartItemsDto) {
    return this.cart.clearItems(req.authenticatedCustomer.userId, dto);
  }
}
