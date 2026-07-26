import {
  ForbiddenException,
  UnauthorizedException
} from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { UserRole } from '../src/common/roles/role.enum';
import { RolesGuard } from '../src/common/roles/roles.guard';
import { CustomerAuthArtifactGuard } from '../src/modules/auth-exchange/customer-auth-artifact.guard';
import { CustomerAuthArtifactService } from '../src/modules/auth-exchange/customer-auth-artifact.service';

function contextForHeaders(headers: Record<string, string>): ExecutionContext {
  return {
    getHandler: () => function testHandler() {},
    getClass: () => class TestController {},
    switchToHttp: () => ({
      getRequest: () => ({ headers })
    })
  } as unknown as ExecutionContext;
}

describe('Customer authentication P0 hardening', () => {
  const originalSecret = process.env.CUSTOMER_AUTH_ARTIFACT_SECRET;

  beforeEach(() => {
    process.env.CUSTOMER_AUTH_ARTIFACT_SECRET =
      'test-customer-auth-p0-secret';
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.CUSTOMER_AUTH_ARTIFACT_SECRET;
    } else {
      process.env.CUSTOMER_AUTH_ARTIFACT_SECRET = originalSecret;
    }

    jest.restoreAllMocks();
  });

  test('legacy RolesGuard fails closed even when role and user headers are forged', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([
        UserRole.CUSTOMER
      ])
    };
    const guard = new RolesGuard(reflector as any);

    expect(() => guard.canActivate(
      contextForHeaders({
        'x-role': 'CUSTOMER',
        'x-user-id': 'victim-customer'
      })
    )).toThrow(
      new ForbiddenException(
        'Legacy header-based role authorization is disabled'
      )
    );
  });

  test('legacy RolesGuard remains a no-op only when no role metadata exists', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined)
    };
    const guard = new RolesGuard(reflector as any);

    expect(guard.canActivate(
      contextForHeaders({
        'x-role': 'ADMIN',
        'x-user-id': 'victim-customer'
      })
    )).toBe(true);
  });

  test('forged legacy headers cannot replace a missing signed artifact', () => {
    const guard = new CustomerAuthArtifactGuard(
      new CustomerAuthArtifactService()
    );

    expect(() => guard.canActivate(
      contextForHeaders({
        'x-role': 'CUSTOMER',
        'x-user-id': 'victim-customer'
      })
    )).toThrow(
      new UnauthorizedException(
        'Missing Bearer customer auth artifact'
      )
    );
  });

  test('signed artifact subject wins over conflicting legacy headers', () => {
    const service = new CustomerAuthArtifactService();
    const guard = new CustomerAuthArtifactGuard(service);
    const artifact = service.issue({
      provider: 'wechat',
      userId: 'wechat:signed-customer',
      role: UserRole.CUSTOMER
    });
    const request = {
      headers: {
        authorization: `Bearer ${artifact}`,
        'x-role': 'ADMIN',
        'x-user-id': 'victim-customer'
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
      userId: 'wechat:signed-customer',
      role: UserRole.CUSTOMER
    });
  });

  test('artifact with an empty subject fails closed', () => {
    const service = new CustomerAuthArtifactService();
    const artifact = service.issue({
      provider: 'wechat',
      userId: '   ',
      role: UserRole.CUSTOMER
    });

    expect(() => service.verify(artifact)).toThrow(
      new UnauthorizedException(
        'Invalid customer auth artifact userId'
      )
    );
  });
});
