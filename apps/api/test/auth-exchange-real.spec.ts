import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { UserRole } from '../src/common/roles/role.enum';
import { AuthExchangeController } from '../src/modules/auth-exchange/auth-exchange.controller';
import { AuthExchangeService } from '../src/modules/auth-exchange/auth-exchange.service';

describe('Auth exchange real boundary', () => {
  test('service real exchange fails honestly when providerCode is missing', async () => {
    const service = new AuthExchangeService({
      exchangeCode: jest.fn()
    } as any, {
      issue: jest.fn(),
      verify: jest.fn()
    } as any);

    await expect(
      service.exchangeReal({
        providerCode: '   ',
        providerState: 'state-1',
        raw: { debugSource: 'real-auth-entry' }
      })
    ).rejects.toThrow(new BadRequestException('Missing providerCode'));
  });

  test('service real exchange success returns normalized auth result', async () => {
    const exchangeCode = jest.fn().mockResolvedValue({ openId: 'openid-1' });
    const issue = jest.fn().mockReturnValue('signed-artifact-1');
    const service = new AuthExchangeService({
      exchangeCode
    } as any, {
      issue,
      verify: jest.fn()
    } as any);

    await expect(
      service.exchangeReal({
        providerCode: ' code-1 ',
        providerState: 'state-1',
        raw: { debugSource: 'real-auth-entry' }
      })
    ).resolves.toEqual({
      provider: 'wechat',
      userId: 'wechat:openid-1',
      role: UserRole.CUSTOMER,
      authArtifact: 'signed-artifact-1'
    });

    expect(exchangeCode).toHaveBeenCalledWith('code-1');
    expect(issue).toHaveBeenCalledWith({
      provider: 'wechat',
      userId: 'wechat:openid-1',
      role: UserRole.CUSTOMER
    });
  });

  test('service real exchange upstream failure returns honest failure', async () => {
    const service = new AuthExchangeService({
      exchangeCode: jest.fn().mockRejectedValue(new BadGatewayException('Wechat miniapp auth exchange failed: invalid code'))
    } as any, {
      issue: jest.fn(),
      verify: jest.fn()
    } as any);

    await expect(
      service.exchangeReal({
        providerCode: 'code-1',
        raw: { debugSource: 'real-auth-entry' }
      })
    ).rejects.toThrow(new BadGatewayException('Wechat miniapp auth exchange failed: invalid code'));
  });

  test('controller forwards real exchange dto to service and returns normalized result', async () => {
    const service = {
      exchangeReal: jest.fn().mockResolvedValue({
        provider: 'wechat',
        userId: 'wechat:openid-2',
        role: UserRole.CUSTOMER,
        authArtifact: 'signed-artifact-2'
      })
    } as any;

    const controller = new AuthExchangeController(service);
    const payload = {
      providerCode: 'code-1',
      providerState: 'state-1',
      raw: { debugSource: 'real-auth-entry' }
    };

    await expect(controller.exchangeReal(payload as any)).resolves.toEqual({
      provider: 'wechat',
      userId: 'wechat:openid-2',
      role: UserRole.CUSTOMER,
      authArtifact: 'signed-artifact-2'
    });
    expect(service.exchangeReal).toHaveBeenCalledWith(payload);
  });
});
