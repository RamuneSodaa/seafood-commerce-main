import { Allow, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AuthExchangePlaceholderDto {
  @IsString()
  @IsIn(['mock', 'wechat'])
  provider!: 'mock' | 'wechat';

  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @Allow()
  raw?: unknown;
}
