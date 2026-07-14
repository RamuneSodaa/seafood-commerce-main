import { createHmac, timingSafeEqual } from 'node:crypto';
import { BadRequestException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import type { AdminUser } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { hashAdminPassword, validateNewAdminPassword, verifyAdminPassword } from './password-hash';
import type { AdminAuthIdentity } from './admin-auth.types';

const WEAK_SECRET_VALUES = new Set(['changeme', 'change-me', 'default', 'secret', 'dev', 'development', 'test', 'placeholder', 'admin', 'password']);

function isProductionRuntime(): boolean {
  return (process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
}

type AdminTokenPayload = AdminAuthIdentity & {
  iat: number;
  exp: number;
};

@Injectable()
export class AdminAuthService {
  constructor(private readonly prisma: PrismaService) {}

  // Phase 2.41B：生产强制独立强随机 ADMIN_AUTH_SECRET，不回退 CUSTOMER_AUTH_ARTIFACT_SECRET；本地保留兼容（带 warning）。不打印 secret 值。
  private getTokenSecret() {
    const adminSecret = process.env.ADMIN_AUTH_SECRET?.trim();
    const customerSecret = process.env.CUSTOMER_AUTH_ARTIFACT_SECRET?.trim();

    if (isProductionRuntime()) {
      if (!adminSecret) {
        throw new InternalServerErrorException('生产环境必须设置 ADMIN_AUTH_SECRET（不允许回退 CUSTOMER_AUTH_ARTIFACT_SECRET）。');
      }
      if (adminSecret.length < 32) {
        throw new InternalServerErrorException('生产环境 ADMIN_AUTH_SECRET 长度至少 32 字符。');
      }
      if (customerSecret && adminSecret === customerSecret) {
        throw new InternalServerErrorException('生产环境 ADMIN_AUTH_SECRET 不能与 CUSTOMER_AUTH_ARTIFACT_SECRET 相同。');
      }
      if (WEAK_SECRET_VALUES.has(adminSecret.toLowerCase())) {
        throw new InternalServerErrorException('生产环境 ADMIN_AUTH_SECRET 不能使用弱/占位值。');
      }
      return adminSecret;
    }

    // 非生产：优先 ADMIN_AUTH_SECRET，允许回退 CUSTOMER_AUTH_ARTIFACT_SECRET，但提示（不打印值）。
    if (adminSecret) return adminSecret;
    if (customerSecret) {
      if (!this.warnedSecretFallback) {
        this.warnedSecretFallback = true;
        console.warn('[admin-auth] ADMIN_AUTH_SECRET 未设置，开发环境回退使用 CUSTOMER_AUTH_ARTIFACT_SECRET；生产环境必须独立设置 ADMIN_AUTH_SECRET。');
      }
      return customerSecret;
    }
    throw new InternalServerErrorException('Admin auth secret is not configured');
  }

  private warnedSecretFallback = false;

  private getTokenTtlSeconds() {
    const configured = Number(process.env.ADMIN_AUTH_TOKEN_TTL_SECONDS || '');
    if (Number.isFinite(configured) && configured > 0) {
      return configured;
    }
    return 8 * 60 * 60;
  }

  private sign(payloadSegment: string) {
    return createHmac('sha256', this.getTokenSecret()).update(payloadSegment).digest('base64url');
  }

  private serializeAdmin(admin: Pick<AdminUser, 'id' | 'username' | 'displayName' | 'role' | 'storeId'>): AdminAuthIdentity {
    return {
      adminId: admin.id,
      username: admin.username,
      displayName: admin.displayName,
      role: admin.role,
      storeId: admin.storeId
    };
  }

  async login(usernameInput: string, password: string) {
    const username = usernameInput.trim();
    const admin = await this.prisma.adminUser.findUnique({ where: { username } });

    if (!admin || !admin.isActive || !verifyAdminPassword(password, admin.passwordHash)) {
      throw new UnauthorizedException('Invalid admin credentials');
    }

    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() }
    });

    const identity = this.serializeAdmin(admin);
    const token = this.issueToken(identity);

    return {
      token,
      expiresAt: new Date((this.decodeToken(token).exp || 0) * 1000).toISOString(),
      admin: identity
    };
  }

  issueToken(identity: AdminAuthIdentity) {
    const now = Math.floor(Date.now() / 1000);
    const payload: AdminTokenPayload = {
      ...identity,
      iat: now,
      exp: now + this.getTokenTtlSeconds()
    };
    const payloadSegment = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = this.sign(payloadSegment);
    return `${payloadSegment}.${signature}`;
  }

  decodeToken(token: string): AdminTokenPayload {
    const [payloadSegment, signature] = token.split('.');
    if (!payloadSegment || !signature) {
      throw new UnauthorizedException('Invalid admin token');
    }

    const expected = Buffer.from(this.sign(payloadSegment));
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new UnauthorizedException('Invalid admin token');
    }

    let payload: AdminTokenPayload;
    try {
      payload = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf8')) as AdminTokenPayload;
    } catch {
      throw new UnauthorizedException('Invalid admin token');
    }

    if (!payload.adminId || !payload.username || !payload.role || !payload.exp) {
      throw new UnauthorizedException('Invalid admin token');
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) {
      throw new UnauthorizedException('Admin token expired');
    }

    return payload;
  }

  async verifyBearerToken(token: string): Promise<AdminAuthIdentity> {
    const payload = this.decodeToken(token);
    const admin = await this.prisma.adminUser.findUnique({ where: { id: payload.adminId } });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Admin account is inactive');
    }

    return this.serializeAdmin(admin);
  }

  // Phase 2.41B：当前登录管理员修改自己的密码。不返回 token / passwordHash；不记录密码。
  async changePassword(adminId: string, currentPassword: string, newPassword: string, confirmPassword: string) {
    const admin = await this.prisma.adminUser.findUnique({ where: { id: adminId } });
    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Admin account is inactive');
    }

    if (!verifyAdminPassword(currentPassword, admin.passwordHash)) {
      throw new BadRequestException('当前密码错误');
    }

    if ((newPassword ?? '').trim() !== (confirmPassword ?? '').trim()) {
      throw new BadRequestException('两次输入的新密码不一致');
    }

    const policyError = validateNewAdminPassword(newPassword);
    if (policyError) {
      throw new BadRequestException(policyError);
    }

    if (verifyAdminPassword(newPassword.trim(), admin.passwordHash)) {
      throw new BadRequestException('新密码不能与当前密码相同');
    }

    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { passwordHash: hashAdminPassword(newPassword.trim()) }
    });

    return { ok: true };
  }
}
