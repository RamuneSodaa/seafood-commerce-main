import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { UserRole } from '../src/common/roles/role.enum';
import { CustomerAuthArtifactGuard } from '../src/modules/auth-exchange/customer-auth-artifact.guard';
import { CustomerAuthArtifactService } from '../src/modules/auth-exchange/customer-auth-artifact.service';
import { CustomerAddressesController } from '../src/modules/customer-addresses/customer-addresses.controller';

const SAMPLE_ADDRESS_DTO = {
  receiverName: '测试顾客',
  phone: '13800000000',
  province: '浙江省',
  city: '杭州市',
  district: '西湖区',
  detail: '文三路 1 号',
  postalCode: '310000'
};

function authenticateCustomer(userId: string, extraHeaders: Record<string, string> = {}) {
  const service = new CustomerAuthArtifactService();
  const guard = new CustomerAuthArtifactGuard(service);
  const artifact = service.issue({
    provider: 'wechat',
    userId,
    role: UserRole.CUSTOMER
  });
  const request = {
    headers: {
      ...extraHeaders,
      authorization: `Bearer ${artifact}`
    }
  } as any;
  const context = {
    switchToHttp: () => ({
      getRequest: () => request
    })
  } as ExecutionContext;

  expect(guard.canActivate(context)).toBe(true);
  return request;
}

describe('Customer addresses trusted authentication boundary', () => {
  const originalSecret = process.env.CUSTOMER_AUTH_ARTIFACT_SECRET;

  beforeEach(() => {
    process.env.CUSTOMER_AUTH_ARTIFACT_SECRET = 'test-customer-auth-secret';
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.CUSTOMER_AUTH_ARTIFACT_SECRET;
    } else {
      process.env.CUSTOMER_AUTH_ARTIFACT_SECRET = originalSecret;
    }
  });

  test('shared list route uses backend-verified customer identity', async () => {
    const list = jest.fn().mockResolvedValue([
      {
        id: 'addr-1',
        customerId: 'wechat:verified-customer'
      }
    ]);
    const controller = new CustomerAddressesController({
      list,
      create: jest.fn(),
      setDefault: jest.fn()
    } as any);
    const request = authenticateCustomer(
      'wechat:verified-customer',
      {
        'x-role': 'ADMIN',
        'x-user-id': 'victim-customer'
      }
    );

    const result = await controller.list(request);

    expect(list).toHaveBeenCalledWith('wechat:verified-customer');
    expect(result).toEqual([
      {
        id: 'addr-1',
        customerId: 'wechat:verified-customer'
      }
    ]);
  });

  test('authenticated list alias uses backend-verified customer identity', async () => {
    const list = jest.fn().mockResolvedValue([]);
    const controller = new CustomerAddressesController({
      list,
      create: jest.fn(),
      setDefault: jest.fn()
    } as any);
    const request = authenticateCustomer('wechat:list-alias');

    await controller.listAuthenticated(request);

    expect(list).toHaveBeenCalledWith('wechat:list-alias');
  });

  test('shared create route ignores conflicting legacy identity headers', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'addr-write',
      customerId: 'wechat:verified-writer'
    });
    const controller = new CustomerAddressesController({
      list: jest.fn(),
      create,
      setDefault: jest.fn()
    } as any);
    const request = authenticateCustomer(
      'wechat:verified-writer',
      {
        'x-role': 'ADMIN',
        'x-user-id': 'victim-customer'
      }
    );

    const result = await controller.create(
      request,
      SAMPLE_ADDRESS_DTO as any
    );

    expect(create).toHaveBeenCalledWith(
      'wechat:verified-writer',
      SAMPLE_ADDRESS_DTO
    );
    expect(result).toEqual({
      id: 'addr-write',
      customerId: 'wechat:verified-writer'
    });
  });

  test('authenticated create alias uses backend-verified customer identity', async () => {
    const create = jest.fn().mockResolvedValue({});
    const controller = new CustomerAddressesController({
      list: jest.fn(),
      create,
      setDefault: jest.fn()
    } as any);
    const request = authenticateCustomer('wechat:create-alias');

    await controller.createAuthenticated(
      request,
      SAMPLE_ADDRESS_DTO as any
    );

    expect(create).toHaveBeenCalledWith(
      'wechat:create-alias',
      SAMPLE_ADDRESS_DTO
    );
  });

  test('shared set-default route ignores conflicting legacy identity headers', async () => {
    const setDefault = jest.fn().mockResolvedValue({
      id: 'addr-default',
      customerId: 'wechat:verified-default',
      isDefault: true
    });
    const controller = new CustomerAddressesController({
      list: jest.fn(),
      create: jest.fn(),
      setDefault
    } as any);
    const request = authenticateCustomer(
      'wechat:verified-default',
      {
        'x-role': 'CUSTOMER',
        'x-user-id': 'victim-customer'
      }
    );

    const result = await controller.setDefault(
      request,
      'addr-default'
    );

    expect(setDefault).toHaveBeenCalledWith(
      'wechat:verified-default',
      'addr-default'
    );
    expect(result).toEqual({
      id: 'addr-default',
      customerId: 'wechat:verified-default',
      isDefault: true
    });
  });

  test('authenticated set-default alias uses backend-verified customer identity', async () => {
    const setDefault = jest.fn().mockResolvedValue({});
    const controller = new CustomerAddressesController({
      list: jest.fn(),
      create: jest.fn(),
      setDefault
    } as any);
    const request = authenticateCustomer('wechat:default-alias');

    await controller.setDefaultAuthenticated(
      request,
      'addr-alias'
    );

    expect(setDefault).toHaveBeenCalledWith(
      'wechat:default-alias',
      'addr-alias'
    );
  });

  test('forged legacy headers without a signed artifact are rejected', () => {
    const guard = new CustomerAuthArtifactGuard(
      new CustomerAuthArtifactService()
    );
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            'x-role': 'CUSTOMER',
            'x-user-id': 'victim-customer'
          }
        })
      })
    } as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(
      new UnauthorizedException(
        'Missing Bearer customer auth artifact'
      )
    );
  });

  test('tampered signed artifact is rejected even with legacy headers', () => {
    const service = new CustomerAuthArtifactService();
    const guard = new CustomerAuthArtifactGuard(service);
    const artifact = service.issue({
      provider: 'wechat',
      userId: 'wechat:verified-writer',
      role: UserRole.CUSTOMER
    });
    const tamperedArtifact = `${artifact.slice(0, -1)}x`;
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            authorization: `Bearer ${tamperedArtifact}`,
            'x-role': 'CUSTOMER',
            'x-user-id': 'victim-customer'
          }
        })
      })
    } as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(
      new UnauthorizedException(
        'Invalid customer auth artifact signature'
      )
    );
  });
});
