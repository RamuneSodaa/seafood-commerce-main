import { IsString, MinLength } from 'class-validator';

// Phase 2.41B：管理员修改自己密码。强度细则在 service 用 validateNewAdminPassword 复核。
export class AdminChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(12)
  newPassword!: string;

  @IsString()
  confirmPassword!: string;
}
