import { IsString } from 'class-validator';

export class BindReferralDto {
  @IsString()
  inviteCode!: string;
}
