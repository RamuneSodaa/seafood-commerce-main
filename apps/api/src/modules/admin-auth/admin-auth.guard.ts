import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AdminAuthService } from './admin-auth.service';
import type { RequestWithAdmin } from './admin-auth.types';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly auth: AdminAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithAdmin>();
    const authorization = req.headers.authorization;
    const header = Array.isArray(authorization) ? authorization[0] : authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';

    if (!token) {
      throw new UnauthorizedException('Admin login required');
    }

    req.admin = await this.auth.verifyBearerToken(token);
    return true;
  }
}
