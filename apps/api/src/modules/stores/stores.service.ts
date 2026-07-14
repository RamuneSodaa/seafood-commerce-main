import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreateStoreDto, UpdateStoreDto } from './dto/store.dto';

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.store.findMany({ orderBy: { createdAt: 'desc' } });
  }

  create(dto: CreateStoreDto) {
    return this.prisma.store.create({ data: dto });
  }

  async update(id: string, dto: UpdateStoreDto) {
    const exists = await this.prisma.store.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Store not found');
    return this.prisma.store.update({ where: { id }, data: dto });
  }
}
