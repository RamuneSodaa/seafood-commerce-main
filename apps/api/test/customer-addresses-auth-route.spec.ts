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

describe('Customer addresses auth route migration', () => {
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

  test('shared list route preserves existing header-based customer scope', async () => {
    const list = jest.fn().mockResolvedValue([
      {
        id: 'addr-legacy',
        customerId: 'legacy-customer'
      }
    ]);
    const controller = new CustomerAddressesController({
      list,
      create: jest.fn(),
      setDefault: jest.fn()
    } as any);

    const result = await controller.list('legacy-customer');

    expect(list).toHaveBeenCalledWith('legacy-customer');
    expect(result).toEqual([
      {
        id: 'addr-legacy',
        customerId: 'legacy-customer'
      }
    ]);
  });

  test('authenticated list route uses backend-verified authenticated customer identity', async () => {
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

    const result = await controller.listAuthenticated({
      authenticatedCustomer: {
        provider: 'wechat',
        userId: 'wechat:verified-customer',
        role: 'CUSTOMER'
      }
    } as any);

    expect(list).toHaveBeenCalledWith('wechat:verified-customer');
    expect(result).toEqual([
      {
        id: 'addr-1',
        customerId: 'wechat:verified-customer'
      }
    ]);
  });

  test('shared create route preserves existing header-based customer scope', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'addr-legacy-write',
      customerId: 'legacy-customer'
    });
    const controller = new CustomerAddressesController({
      list: jest.fn(),
      create,
      setDefault: jest.fn()
    } as any);

    const result = await controller.create('legacy-customer', SAMPLE_ADDRESS_DTO as any);

    expect(create).toHaveBeenCalledWith('legacy-customer', SAMPLE_ADDRESS_DTO);
    expect(result).toEqual({
      id: 'addr-legacy-write',
      customerId: 'legacy-customer'
    });
  });

  test('authenticated create route uses backend-verified authenticated customer identity', async () => {
    const service = new CustomerAuthArtifactService();
    const guard = new CustomerAuthArtifactGuard(service);
    const create = jest.fn().mockResolvedValue({
      id: 'addr-authenticated-write',
      customerId: 'wechat:verified-writer'
    });
    const controller = new CustomerAddressesController({
      list: jest.fn(),
      create,
      setDefault: jest.fn()
    } as any);
    const artifact = service.issue({
      provider: 'wechat',
      userId: 'wechat:verified-writer',
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

    const result = await controller.createAuthenticated(request, SAMPLE_ADDRESS_DTO as any);

    expect(create).toHaveBeenCalledWith('wechat:verified-writer', SAMPLE_ADDRESS_DTO);
    expect(result).toEqual({
      id: 'addr-authenticated-write',
      customerId: 'wechat:verified-writer'
    });
  });

  test('authenticated create seam fails honestly when auth artifact is missing', () => {
    const guard = new CustomerAuthArtifactGuard(new CustomerAuthArtifactService());
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {}
        })
      })
    } as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(new UnauthorizedException('Missing Bearer customer auth artifact'));
  });

  test('authenticated create seam fails honestly when auth artifact is invalid', () => {
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
            authorization: `Bearer ${tamperedArtifact}`
          }
        })
      })
    } as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(new UnauthorizedException('Invalid customer auth artifact signature'));
  });

  test('shared set-default route preserves existing header-based customer scope', async () => {
    const setDefault = jest.fn().mockResolvedValue({
      id: 'addr-legacy-default',
      customerId: 'legacy-customer',
      isDefault: true
    });
    const controller = new CustomerAddressesController({
      list: jest.fn(),
      create: jest.fn(),
      setDefault
    } as any);

    const result = await controller.setDefault('legacy-customer', 'addr-legacy-default');

    expect(setDefault).toHaveBeenCalledWith('legacy-customer', 'addr-legacy-default');
    expect(result).toEqual({
      id: 'addr-legacy-default',
      customerId: 'legacy-customer',
      isDefault: true
    });
  });

  test('authenticated set-default route uses backend-verified authenticated customer identity', async () => {
    const service = new CustomerAuthArtifactService();
    const guard = new CustomerAuthArtifactGuard(service);
    const setDefault = jest.fn().mockResolvedValue({
      id: 'addr-authenticated-default',
      customerId: 'wechat:verified-writer',
      isDefault: true
    });
    const controller = new CustomerAddressesController({
      list: jest.fn(),
      create: jest.fn(),
      setDefault
    } as any);
    const artifact = service.issue({
      provider: 'wechat',
      userId: 'wechat:verified-writer',
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

    const result = await controller.setDefaultAuthenticated(request, 'addr-authenticated-default');

    expect(setDefault).toHaveBeenCalledWith('wechat:verified-writer', 'addr-authenticated-default');
    expect(result).toEqual({
      id: 'addr-authenticated-default',
      customerId: 'wechat:verified-writer',
      isDefault: true
    });
  });

  test('authenticated set-default seam fails honestly when auth artifact is missing', () => {
    const guard = new CustomerAuthArtifactGuard(new CustomerAuthArtifactService());
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {}
        })
      })
    } as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(new UnauthorizedException('Missing Bearer customer auth artifact'));
  });

  test('authenticated set-default seam fails honestly when auth artifact is invalid', () => {
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
            authorization: `Bearer ${tamperedArtifact}`
          }
        })
      })
    } as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(new UnauthorizedException('Invalid customer auth artifact signature'));
  });
});
