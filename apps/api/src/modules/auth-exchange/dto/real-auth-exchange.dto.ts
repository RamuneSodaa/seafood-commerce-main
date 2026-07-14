import { Allow, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RealAuthExchangeDto {
  @IsString()
  @IsNotEmpty()
  providerCode!: string;

  @IsOptional()
  @IsString()
  providerState?: string;

  @IsOptional()
  @Allow()
  callbackPayload?: unknown;

  @IsOptional()
  @Allow()
  raw?: unknown;
}
