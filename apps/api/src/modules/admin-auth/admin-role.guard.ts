import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AdminRole } from '@prisma/client';
import { ADMIN_ROLES_KEY } from './admin-role.decorator';
import type { RequestWithAdmin } from './admin-auth.types';

@Injectable()
export class AdminRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AdminRole[]>(ADMIN_ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<RequestWithAdmin>();
    if (!req.admin || !requiredRoles.includes(req.admin.role)) {
      throw new ForbiddenException('Admin role is not allowed for this action');
    }

    return true;
  }
}
