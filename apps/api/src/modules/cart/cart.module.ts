import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CustomerAuthArtifactGuard } from '../auth-exchange/customer-auth-artifact.guard';
import { CustomerAuthArtifactService } from '../auth-exchange/customer-auth-artifact.service';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

@Module({
  controllers: [CartController],
  providers: [PrismaService, CustomerAuthArtifactService, CustomerAuthArtifactGuard, CartService]
})
export class CartModule {}
