import { IsOptional, IsString } from 'class-validator';

export class ClaimCouponDto {
  @IsOptional()
  @IsString()
  templateCode?: string;

  @IsOptional()
  @IsString()
  templateId?: string;
}
