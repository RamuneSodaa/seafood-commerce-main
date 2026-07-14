import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreateCustomerAddressDto } from './dto/customer-address.dto';

@Injectable()
export class CustomerAddressesService {
  constructor(private readonly prisma: PrismaService) {}

  private getCustomerId(userId?: string): string {
    if (!userId) {
      throw new ForbiddenException('Customer address scope requires x-user-id');
    }

    return userId;
  }

  async list(userId?: string) {
    const customerId = this.getCustomerId(userId);

    return this.prisma.customerAddress.findMany({
      where: { customerId },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
    });
  }

  async create(userId: string | undefined, dto: CreateCustomerAddressDto) {
    const customerId = this.getCustomerId(userId);

    return this.prisma.$transaction(async (tx) => {
      const addressCount = await tx.customerAddress.count({
        where: { customerId }
      });

      return tx.customerAddress.create({
        data: {
          customerId,
          receiverName: dto.receiverName.trim(),
          phone: dto.phone.trim(),
          province: dto.province.trim(),
          city: dto.city.trim(),
          district: dto.district.trim(),
          detail: dto.detail.trim(),
          postalCode: dto.postalCode?.trim() || null,
          isDefault: addressCount === 0
        }
      });
    });
  }

  async setDefault(userId: string | undefined, addressId: string) {
    const customerId = this.getCustomerId(userId);

    return this.prisma.$transaction(async (tx) => {
      const address = await tx.customerAddress.findUnique({
        where: { id: addressId }
      });

      if (!address || address.customerId !== customerId) {
        throw new NotFoundException('Address not found');
      }

      await tx.customerAddress.updateMany({
        where: { customerId, isDefault: true },
        data: { isDefault: false }
      });

      return tx.customerAddress.update({
        where: { id: addressId },
        data: { isDefault: true }
      });
    });
  }
}
