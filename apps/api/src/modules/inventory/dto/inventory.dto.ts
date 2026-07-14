import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class InventoryQueryDto {
  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @IsString()
  skuId?: string;
}

export class AdjustInventoryDto {
  @IsString()
  storeId!: string;

  @IsString()
  skuId!: string;

  @IsInt()
  deltaPhysical!: number;

  @IsInt()
  deltaAvailable!: number;

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsOptional()
  @IsString()
  note?: string;
}
