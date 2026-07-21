import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { AdminAuthModule } from './modules/admin-auth/admin-auth.module';
import { AuthExchangeModule } from './modules/auth-exchange/auth-exchange.module';
import { CartModule } from './modules/cart/cart.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { CustomerAddressesModule } from './modules/customer-addresses/customer-addresses.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { MembersModule } from './modules/members/members.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ProductsModule } from './modules/products/products.module';
import { ProductAssetsModule } from './modules/product-assets/product-assets.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { StoresModule } from './modules/stores/stores.module';

@Module({
  controllers: [HealthController],
  imports: [
    AdminAuthModule,
    AuthExchangeModule,
    OrdersModule,
    ProductsModule,
    ProductAssetsModule,
    StoresModule,
    InventoryModule,
    CustomerAddressesModule,
    CartModule,
    CouponsModule,
    MembersModule,
    ReferralsModule
  ]
})
export class AppModule {}
