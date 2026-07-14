import type { AuthSuccessResult } from '../../../packages/shared-types/src';
import { UserRole } from '../src/common/roles/role.enum';
import { AuthExchangeController } from '../src/modules/auth-exchange/auth-exchange.controller';
import { AuthExchangeService } from '../src/modules/auth-exchange/auth-exchange.service';

describe('Auth exchange placeholder boundary', () => {
  test('service normalizes payload and fixes role to CUSTOMER', () => {
    const service = new AuthExchangeService({
      exchangeCode: jest.fn()
    } as any, {
      issue: jest.fn(),
      verify: jest.fn()
    } as any);
    const rawPayload = { debugSource: 'auth-entry', nested: { ok: true } };

    const result: AuthSuccessResult = service.exchangePlaceholder({
      provider: 'wechat',
      userId: ' customer-1 ',
      displayName: ' 演示顾客 ',
      raw: rawPayload,
      role: 'ADMIN'
    } as any);

    expect(result).toEqual({
      provider: 'wechat',
      userId: 'customer-1',
      role: UserRole.CUSTOMER,
      displayName: '演示顾客',
      raw: rawPayload
    });
  });

  test('service keeps raw as placeholder passthrough only and returns no session or business fields', () => {
    const service = new AuthExchangeService({
      exchangeCode: jest.fn()
    } as any, {
      issue: jest.fn(),
      verify: jest.fn()
    } as any);

    const result = service.exchangePlaceholder({
      provider: 'mock',
      userId: 'customer-2',
      raw: { traceId: 'trace-1' }
    });

    expect(result.raw).toEqual({ traceId: 'trace-1' });
    expect(result.displayName).toBeUndefined();
    expect(result).not.toHaveProperty('session');
    expect(result).not.toHaveProperty('token');
    expect(result).not.toHaveProperty('orderId');
    expect(result).not.toHaveProperty('status');
    expect(Object.keys(result).sort()).toEqual(['displayName', 'provider', 'raw', 'role', 'userId']);
  });

  test('controller forwards dto to service and returns placeholder result', () => {
    const service = {
      exchangePlaceholder: jest.fn().mockReturnValue({
        provider: 'mock',
        userId: 'customer-3',
        role: UserRole.CUSTOMER,
        displayName: '演示顾客',
        raw: { debugSource: 'auth-entry' }
      })
    } as any;

    const controller = new AuthExchangeController(service);
    const payload = {
      provider: 'mock',
      userId: 'customer-3',
      displayName: '演示顾客',
      raw: { debugSource: 'auth-entry' }
    };

    const result = controller.exchangePlaceholder(payload as any);

    expect(service.exchangePlaceholder).toHaveBeenCalledWith(payload);
    expect(result).toEqual({
      provider: 'mock',
      userId: 'customer-3',
      role: UserRole.CUSTOMER,
      displayName: '演示顾客',
      raw: { debugSource: 'auth-entry' }
    });
  });
});
