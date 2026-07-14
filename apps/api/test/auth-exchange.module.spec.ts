import { Test } from '@nestjs/testing';
import { AuthExchangeController } from '../src/modules/auth-exchange/auth-exchange.controller';
import { AuthExchangeModule } from '../src/modules/auth-exchange/auth-exchange.module';
import { AuthExchangeService } from '../src/modules/auth-exchange/auth-exchange.service';
import { CustomerAuthArtifactService } from '../src/modules/auth-exchange/customer-auth-artifact.service';
import { WechatMiniappAuthClient } from '../src/modules/auth-exchange/wechat-miniapp-auth.client';

describe('Auth exchange module wiring', () => {
  test('auth exchange module instantiates controller and service without DI failure', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AuthExchangeModule]
    })
      .overrideProvider(WechatMiniappAuthClient)
      .useValue({
        exchangeCode: jest.fn()
      })
      .overrideProvider(CustomerAuthArtifactService)
      .useValue({
        issue: jest.fn(),
        verify: jest.fn()
      })
      .compile();

    expect(moduleRef.get(AuthExchangeController)).toBeInstanceOf(AuthExchangeController);
    expect(moduleRef.get(AuthExchangeService)).toBeInstanceOf(AuthExchangeService);

    await moduleRef.close();
  });
});
