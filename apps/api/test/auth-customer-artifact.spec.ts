import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { UserRole } from '../src/common/roles/role.enum';
import { CustomerAuthArtifactGuard } from '../src/modules/auth-exchange/customer-auth-artifact.guard';
import { CustomerAuthArtifactService } from '../src/modules/auth-exchange/customer-auth-artifact.service';

describe('Customer auth artifact boundary', () => {
  const originalSecret = process.env.CUSTOMER_AUTH_ARTIFACT_SECRET;
  const originalTtlSeconds = process.env.CUSTOMER_AUTH_ARTIFACT_TTL_SECONDS;

  beforeEach(() => {
    process.env.CUSTOMER_AUTH_ARTIFACT_SECRET = 'test-customer-auth-secret';
    process.env.CUSTOMER_AUTH_ARTIFACT_TTL_SECONDS = '604800';
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.CUSTOMER_AUTH_ARTIFACT_SECRET;
    } else {
      process.env.CUSTOMER_AUTH_ARTIFACT_SECRET = originalSecret;
    }

    if (originalTtlSeconds === undefined) {
      delete process.env.CUSTOMER_AUTH_ARTIFACT_TTL_SECONDS;
    } else {
      process.env.CUSTOMER_AUTH_ARTIFACT_TTL_SECONDS = originalTtlSeconds;
    }

    jest.restoreAllMocks();
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

  test('artifact service rejects an expired signed customer artifact', () => {
    process.env.CUSTOMER_AUTH_ARTIFACT_TTL_SECONDS = '60';

    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1_700_000_000_000);

    const service = new CustomerAuthArtifactService();
    const artifact = service.issue({
      provider: 'wechat',
      userId: 'wechat:expired-openid',
      role: UserRole.CUSTOMER
    });

    nowSpy.mockReturnValue(1_700_000_061_001);

    expect(() => service.verify(artifact)).toThrow(
      new UnauthorizedException('Customer auth artifact expired')
    );
  });

  test('artifact service allows configured five-minute clock skew but rejects a farther future issued-at', () => {
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1_700_000_000_000);

    const service = new CustomerAuthArtifactService();

    nowSpy.mockReturnValue(1_700_000_301_000);
    const futureArtifact = service.issue({
      provider: 'wechat',
      userId: 'wechat:future-openid',
      role: UserRole.CUSTOMER
    });

    nowSpy.mockReturnValue(1_700_000_000_000);

    expect(() => service.verify(futureArtifact)).toThrow(
      new UnauthorizedException('Invalid customer auth artifact issued-at')
    );
  });

  test('artifact service fails closed for invalid TTL configuration', () => {
    process.env.CUSTOMER_AUTH_ARTIFACT_TTL_SECONDS = 'not-a-number';

    const service = new CustomerAuthArtifactService();
    const artifact = service.issue({
      provider: 'wechat',
      userId: 'wechat:ttl-config-openid',
      role: UserRole.CUSTOMER
    });

    expect(() => service.verify(artifact)).toThrow(
      'CUSTOMER_AUTH_ARTIFACT_TTL_SECONDS must be a positive integer'
    );
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
