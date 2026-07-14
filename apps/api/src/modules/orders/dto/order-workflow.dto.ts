import { Type } from 'class-transformer';
import {
  Allow,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from 'class-validator';

enum FulfillmentType {
  STORE_PICKUP = 'STORE_PICKUP',
  SHIPPING = 'SHIPPING'
}

class CreateOrderItemDto {
  @IsString()
  skuId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

class ShippingAddressDto {
  @IsString()
  receiverName!: string;

  @IsString()
  phone!: string;

  @IsString()
  province!: string;

  @IsString()
  city!: string;

  @IsString()
  district!: string;

  @IsString()
  detail!: string;

  @IsOptional()
  @IsString()
  postalCode?: string;
}

export class OrderQuotePreviewDto {
  @IsString()
  storeId!: string;

  @IsEnum(FulfillmentType)
  fulfillmentType!: FulfillmentType;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsString()
  userCouponId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userCouponIds?: string[];
}

export class CreateOrderDto {
  @IsString()
  storeId!: string;

  @IsEnum(FulfillmentType)
  fulfillmentType!: FulfillmentType;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsString()
  userCouponId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userCouponIds?: string[];

  @IsOptional()
  @IsDateString()
  pickupDate?: string;

  @IsOptional()
  @IsString()
  pickupTimeSlot?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress?: ShippingAddressDto;
}

export class MarkPaidDto {
  @IsString()
  @IsNotEmpty()
  paymentRef!: string;

  @IsInt()
  @Min(0)
  paidAmountCents!: number;
}

export class MiniappPaymentCallbackDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  provider?: string;

  @IsOptional()
  @Allow()
  callbackPayload?: unknown;

  @IsOptional()
  @Allow()
  raw?: unknown;
}

export class CompletePickupDto {
  @IsString()
  @IsNotEmpty()
  pickupCode!: string;
}

export class ShipOrderDto {
  @IsString()
  @IsNotEmpty()
  courierCompany!: string;

  @IsString()
  @IsNotEmpty()
  trackingNumber!: string;

  // Phase 2.40B：可选发货备注，写入状态时间线 reason，不暴露给顾客端。
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  shippingNote?: string;
}

// Phase 2.40B：取消订单可选原因（写入 OrderStatusLog.reason）。
export class CancelOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

// Phase 2.40B：订单内部备注（默认 internal，仅后台可见）。
export class CreateOrderNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  type?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  body!: string;
}

// Phase 2.49H：鲜鱼预订门店确认（填实际重量 + 最终单价或总价）。
export class FreshPreorderConfirmDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100000)
  actualWeightJin!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  actualUnitPriceCents?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  finalTotalCents?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  storeConfirmNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  customerContactNote?: string;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

// Phase 2.49H：鲜鱼预订完成线下结算（无业务字段，仅可选 dryRun）。
export class FreshPreorderCompleteDto {
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

// Phase 2.49H：鲜鱼预订取消（cancelReason 必填）。
export class FreshPreorderCancelDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  cancelReason!: string;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
