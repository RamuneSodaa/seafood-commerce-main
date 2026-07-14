import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { UserRole } from '../src/common/roles/role.enum';
import { CustomerAuthArtifactGuard } from '../src/modules/auth-exchange/customer-auth-artifact.guard';
import { CustomerAuthArtifactService } from '../src/modules/auth-exchange/customer-auth-artifact.service';

describe('Customer auth artifact boundary', () => {
  const originalSecret = process.env.CUSTOMER_AUTH_ARTIFACT_SECRET;

  beforeEach(() => {
    process.env.CUSTOMER_AUTH_ARTIFACT_SECRET = 'test-customer-auth-secret';
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.CUSTOMER_AUTH_ARTIFACT_SECRET;
      return;
    }

    process.env.CUSTOMER_AUTH_ARTIFACT_SECRET = originalSecret;
  });

  test('artifact service verifies a valid signed customer artifact', () => {
    const service = new CustomerAuthArtifactService();
    const artifact = service.issue({
      provider: 'wechat',
      userId: 'wechat:openid-1',
      role: UserRole.CUSTOMER
    });

    expect(service.verify(artifact)).toEqual({
      provider: 'wechat',
      userId: 'wechat:openid-1',
      role: UserRole.CUSTOMER
    });
  });

  test('verification seam accepts a valid artifact and recovers authenticated customer identity', () => {
    const service = new CustomerAuthArtifactService();
    const guard = new CustomerAuthArtifactGuard(service);
    const artifact = service.issue({
      provider: 'wechat',
      userId: 'wechat:openid-2',
      role: UserRole.CUSTOMER
    });
    const request = {
      headers: {
        authorization: `Bearer ${artifact}`
      }
    } as any;

    const context = {
      switchToHttp: () => ({
        getRequest: () => request
      })
    } as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
    expect(request.authenticatedCustomer).toEqual({
      provider: 'wechat',
      userId: 'wechat:openid-2',
      role: UserRole.CUSTOMER
    });
  });

  test('verification seam rejects a tampered artifact', () => {
    const service = new CustomerAuthArtifactService();
    const guard = new CustomerAuthArtifactGuard(service);
    const artifact = service.issue({
      provider: 'wechat',
      userId: 'wechat:openid-3',
      role: UserRole.CUSTOMER
    });
    const tamperedArtifact = `${artifact.slice(0, -1)}x`;
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            authorization: `Bearer ${tamperedArtifact}`
          }
        })
      })
    } as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(new UnauthorizedException('Invalid customer auth artifact signature'));
  });
});
