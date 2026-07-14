import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CustomerAuthArtifactGuard } from '../auth-exchange/customer-auth-artifact.guard';
import { CustomerAuthArtifactService } from '../auth-exchange/customer-auth-artifact.service';
import { RolesGuard } from '../../common/roles/roles.guard';
import { CustomerAddressesController } from './customer-addresses.controller';
import { CustomerAddressesService } from './customer-addresses.service';

@Module({
  controllers: [CustomerAddressesController],
  providers: [PrismaService, RolesGuard, CustomerAuthArtifactService, CustomerAuthArtifactGuard, CustomerAddressesService]
})
export class CustomerAddressesModule {}
