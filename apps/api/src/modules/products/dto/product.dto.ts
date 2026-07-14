import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateProductDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsBoolean()
  supportsPickup: boolean = true;

  @IsBoolean()
  supportsShipping: boolean = true;

  @IsString()
  defaultSkuName!: string;

  @IsOptional()
  @IsString()
  defaultSkuCode?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  defaultPriceCents!: number;

  @IsString()
  initialStoreId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  initialStock!: number;
}

// Phase 2.45B：价格未定草稿商品建档 DTO。
// 只允许商品级字段；严禁价格/SKU/库存/门店/发布相关字段（避免占位价/误发布）。
// internalTag 由后端强制为 price_pending，不接受客户端覆盖。
export class CreateDraftProductDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @IsOptional()
  @IsString()
  internalNote?: string;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsBoolean()
  supportsPickup?: boolean;

  @IsOptional()
  @IsBoolean()
  supportsShipping?: boolean;

  @IsOptional()
  @IsString()
  defaultSkuName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  defaultPriceCents?: number;

  // Phase 2.39C：后台内部运营标签/备注（不对顾客端展示，不影响发布/下单）。
  @IsOptional()
  @IsString()
  internalTag?: string;

  @IsOptional()
  @IsString()
  internalNote?: string;
}

// Phase 2.38C：后台多 SKU 管理 DTO。价格单位为分（priceCents），由前端把元×100 后提交。
export class CreateSkuDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceCents!: number;
}

export class UpdateSkuDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceCents?: number;

  // Phase 2.38D：SKU 软禁用/启用（停售/恢复规格）。
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
