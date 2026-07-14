import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminAuthService } from './admin-auth.service';
import type { RequestWithAdmin } from './admin-auth.types';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminChangePasswordDto } from './dto/admin-change-password.dto';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  @Post('login')
  login(@Body() dto: AdminLoginDto) {
    return this.auth.login(dto.username, dto.password);
  }

  @Get('me')
  @UseGuards(AdminAuthGuard)
  me(@Req() req: RequestWithAdmin) {
    return { admin: req.admin };
  }

  // Phase 2.41B：当前登录管理员修改自己的密码。
  @Post('change-password')
  @UseGuards(AdminAuthGuard)
  changePassword(@Body() dto: AdminChangePasswordDto, @Req() req: RequestWithAdmin) {
    return this.auth.changePassword(req.admin!.adminId, dto.currentPassword, dto.newPassword, dto.confirmPassword);
  }
}
