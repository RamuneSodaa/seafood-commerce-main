import { readFileSync } from 'fs';
import { resolve } from 'path';
import vm from 'vm';
import ts from 'typescript';

type ModuleMocks = Record<string, unknown>;

type RuntimeGlobals = {
  fetch?: typeof fetch;
  Headers?: typeof Headers;
};

function source(relative: string): string {
  return readFileSync(
    resolve(__dirname, '../../..', relative),
    'utf8'
  );
}

function loadTypeScriptModule(
  relative: string,
  mocks: ModuleMocks,
  runtimeGlobals: RuntimeGlobals = {}
): Record<string, any> {
  const filename = resolve(__dirname, '../../..', relative);
  const compiled = ts.transpileModule(
    readFileSync(filename, 'utf8'),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true
      },
      fileName: filename
    }
  ).outputText;

  const moduleObject = { exports: {} as Record<string, any> };
  const wrapper = vm.runInThisContext(
    `(function(
      exports,
      require,
      module,
      __filename,
      __dirname,
      fetch,
      Headers
    ) {
      ${compiled}
    })`,
    { filename }
  );

  wrapper(
    moduleObject.exports,
    (id: string) => {
      if (id in mocks) {
        return mocks[id];
      }

      return require(id);
    },
    moduleObject,
    filename,
    resolve(filename, '..'),
    runtimeGlobals.fetch || globalThis.fetch,
    runtimeGlobals.Headers || globalThis.Headers
  );

  return moduleObject.exports;
}

function createMiniappStorageHarness(options?: {
  failOnSetKey?: string;
}) {
  const storage = new Map<string, unknown>();

  const taro = {
    getStorageSync(key: string) {
      return storage.get(key);
    },
    setStorageSync(key: string, value: unknown) {
      if (options?.failOnSetKey === key) {
        throw new Error(`storage write failed: ${key}`);
      }

      storage.set(key, value);
    },
    removeStorageSync(key: string) {
      storage.delete(key);
    }
  };

  const config = {
    DEFAULT_CUSTOMER_ROLE: 'CUSTOMER',
    MINIAPP_CUSTOMER_IDENTITY_STORAGE_KEY:
      'seafood-miniapp-customer-identity',
    MINIAPP_REAL_CUSTOMER_IDENTITY_STORAGE_KEY:
      'seafood-miniapp-real-customer-identity',
    MINIAPP_CUSTOMER_AUTH_ARTIFACT_STORAGE_KEY:
      'seafood-miniapp-customer-auth-artifact'
  };

  const module = loadTypeScriptModule(
    'apps/storefront-miniapp/src/lib/identity-storage.ts',
    {
      '@tarojs/taro': {
        __esModule: true,
        default: taro
      },
      './config': config
    }
  );

  return {
    module,
    storage,
    config
  };
}

describe('Customer client authentication security', () => {
  test('miniapp auth storage clears stale artifacts and stores verified sessions atomically', () => {
    const { module, storage, config } =
      createMiniappStorageHarness();

    storage.set(
      config.MINIAPP_CUSTOMER_AUTH_ARTIFACT_STORAGE_KEY,
      'stale.payload'
    );

    expect(() => module.setStoredCustomerAuthArtifact('')).toThrow(
      'Invalid customer auth artifact'
    );
    expect(
      storage.has(
        config.MINIAPP_CUSTOMER_AUTH_ARTIFACT_STORAGE_KEY
      )
    ).toBe(false);

    const session = module.replaceStoredVerifiedCustomerSession(
      {
        role: 'CUSTOMER',
        userId: 'wechat:customer-a'
      },
      'signed.payload'
    );

    expect(session).toEqual({
      identity: {
        role: 'CUSTOMER',
        userId: 'wechat:customer-a'
      },
      authArtifact: 'signed.payload'
    });

    module.clearAllStoredCustomerIdentities();

    expect(storage.size).toBe(0);
  });

  test('miniapp verified session storage rolls back every key after a partial write failure', () => {
    const artifactKey =
      'seafood-miniapp-customer-auth-artifact';
    const { module, storage } = createMiniappStorageHarness({
      failOnSetKey: artifactKey
    });

    expect(() => module.replaceStoredVerifiedCustomerSession(
      {
        role: 'CUSTOMER',
        userId: 'wechat:customer-b'
      },
      'signed.payload'
    )).toThrow(/storage write failed/);

    expect(storage.size).toBe(0);
  });

  test('miniapp partial stored session self-clears instead of becoming real-storage identity', () => {
    const { module, storage, config } =
      createMiniappStorageHarness();

    storage.set(
      config.MINIAPP_REAL_CUSTOMER_IDENTITY_STORAGE_KEY,
      {
        role: 'CUSTOMER',
        userId: 'wechat:partial'
      }
    );

    expect(module.getStoredVerifiedCustomerSession()).toBeNull();
    expect(storage.size).toBe(0);
  });


  test('miniapp low-level real identity adapter cannot write identity without an artifact', () => {
    const storageSource = source(
      'apps/storefront-miniapp/src/lib/identity-storage.ts'
    );
    const adapterSource = source(
      'apps/storefront-miniapp/src/lib/real-identity-write-adapter.ts'
    );

    expect(storageSource).not.toContain(
      'export function setStoredRealCustomerIdentity'
    );
    expect(adapterSource).toContain(
      'authArtifact: string'
    );
    expect(adapterSource).toContain(
      'replaceStoredVerifiedCustomerSession'
    );
  });

  test('miniapp request clears local auth state and redirects on HTTP 401', async () => {
    jest.useFakeTimers();

    let cleared = 0;
    let redirected = 0;

    const module = loadTypeScriptModule(
      'apps/storefront-miniapp/src/lib/request.ts',
      {
        '@tarojs/taro': {
          __esModule: true,
          default: {
            request: async () => ({
              statusCode: 401,
              data: {
                success: false,
                error: {
                  message: 'Customer auth artifact expired'
                }
              }
            })
          }
        },
        './config': {
          CURRENT_MINIAPP_PROFILE: {
            apiBaseUrl: 'https://api.example.invalid'
          }
        },
        './customer-login-redirect': {
          redirectCurrentPageToCustomerLogin() {
            redirected += 1;
            return true;
          }
        },
        './identity-storage': {
          clearAllStoredCustomerIdentities() {
            cleared += 1;
          }
        }
      }
    );

    await expect(module.request(
      '/orders/authenticated',
      {
        authArtifact: 'signed.payload'
      }
    )).rejects.toMatchObject({
      name: 'CustomerAuthenticationRequiredError',
      code: 'CUSTOMER_AUTH_REQUIRED',
      statusCode: 401
    });

    expect(cleared).toBe(1);
    expect(redirected).toBe(1);

    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test('real login pipeline verifies the signed subject before storing any session', () => {
    const loginSource = source(
      'apps/storefront-miniapp/src/lib/login-success-orchestrator.ts'
    );
    const functionStart = loginSource.indexOf(
      'export async function handleMiniappLoginSuccess('
    );
    const functionEnd = loginSource.indexOf(
      '\nexport function handleMiniappPlaceholderLoginSuccess(',
      functionStart
    );

    expect(functionStart).toBeGreaterThanOrEqual(0);
    expect(functionEnd).toBeGreaterThan(functionStart);

    const loginFunction = loginSource.slice(
      functionStart,
      functionEnd
    );
    const verifyPosition = loginFunction.indexOf(
      'await verifyCustomerAuthArtifact'
    );
    const storePosition = loginFunction.indexOf(
      'const storedSession = replaceStoredVerifiedCustomerSession'
    );

    expect(verifyPosition).toBeGreaterThanOrEqual(0);
    expect(storePosition).toBeGreaterThanOrEqual(0);
    expect(verifyPosition).toBeLessThan(storePosition);
  });

  test('real login runtime stores only after backend subject verification and clears mismatch state', async () => {
    const calls: string[] = [];
    let verifiedUserId = 'wechat:customer-a';
    let storedUserId = '';

    const module = loadTypeScriptModule(
      'apps/storefront-miniapp/src/lib/login-success-orchestrator.ts',
      {
        './config': {
          DEFAULT_CUSTOMER_ROLE: 'CUSTOMER'
        },
        './real-identity-auth-result-mapper': {
          mapMiniappAuthSuccessResultToRealIdentity() {
            return {
              provider: 'wechat',
              realIdentity: {
                role: 'CUSTOMER',
                userId: 'wechat:customer-a'
              },
              authArtifact: 'signed.payload'
            };
          }
        },
        './api': {
          async verifyCustomerAuthArtifact() {
            calls.push('verify');
            return {
              provider: 'wechat',
              role: 'CUSTOMER',
              userId: verifiedUserId
            };
          }
        },
        './identity-storage': {
          clearAllStoredCustomerIdentities() {
            calls.push('clear');
            storedUserId = '';
          },
          replaceStoredVerifiedCustomerSession(
            identity: { role: 'CUSTOMER'; userId: string },
            authArtifact: string
          ) {
            calls.push('store');
            storedUserId = identity.userId;

            return {
              identity,
              authArtifact
            };
          },
          getStoredPlaceholderCustomerIdentity() {
            return null;
          },
          setStoredPlaceholderCustomerIdentity() {
            throw new Error('placeholder storage is not expected');
          }
        },
        './identity': {
          resolveMiniappIdentity() {
            calls.push('resolve');
            return {
              source: 'real-storage',
              identity: {
                role: 'CUSTOMER',
                userId: storedUserId
              }
            };
          }
        }
      }
    );

    const result = await module.handleMiniappLoginSuccess({
      provider: 'wechat',
      role: 'CUSTOMER',
      userId: 'wechat:customer-a',
      authArtifact: 'signed.payload'
    });

    expect(result.backendVerifiedIdentity.userId).toBe(
      'wechat:customer-a'
    );
    expect(calls.indexOf('verify')).toBeLessThan(
      calls.indexOf('store')
    );

    calls.length = 0;
    verifiedUserId = 'wechat:other-customer';

    await expect(module.handleMiniappLoginSuccess({
      provider: 'wechat',
      role: 'CUSTOMER',
      userId: 'wechat:customer-a',
      authArtifact: 'signed.payload'
    })).rejects.toThrow(
      'Verified customer identity does not match auth exchange result'
    );

    expect(calls).not.toContain('store');
    expect(calls.filter((value) => value === 'clear')).toHaveLength(2);
  });

  test('customer login page has no direct pre-verification artifact write', () => {
    const pageSource = source(
      'apps/storefront-miniapp/src/pages/customer-login/index.tsx'
    );

    expect(pageSource).toContain(
      'await handleMiniappLoginSuccess(exchangedResult)'
    );
    expect(pageSource).not.toContain(
      'setStoredCustomerAuthArtifact('
    );
    expect(pageSource).not.toContain(
      'verifyCustomerAuthArtifact('
    );
  });

  test('production miniapp payment path cannot call customer mark-paid', () => {
    const apiSource = source(
      'apps/storefront-miniapp/src/lib/api.ts'
    );
    const paymentSource = source(
      'apps/storefront-miniapp/src/lib/payment-transition.ts'
    );

    expect(apiSource).not.toContain('/mark-paid');
    expect(paymentSource).not.toContain('markPaid');
    expect(paymentSource).not.toContain('manual-');
    expect(paymentSource).toContain('createMiniappPayment');
  });

  test('production miniapp bundle excludes all dev authentication pages', () => {
    const appConfig = source(
      'apps/storefront-miniapp/src/app.config.ts'
    );

    expect(appConfig).not.toMatch(/pages\/dev-/);
  });

  test('web storefront keeps public browsing but holds all customer transactions', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];

    const fetchMock = jest.fn(async (
      input: string | URL | Request,
      init?: RequestInit
    ) => {
      calls.push({
        url: String(input),
        init: init || {}
      });

      return {
        ok: true,
        json: async () => []
      } as Response;
    });

    const module = loadTypeScriptModule(
      'apps/storefront-web/src/lib/api.ts',
      {
        '../../../../packages/shared-types/src': {},
        './config': {
          CURRENT_STOREFRONT_PROFILE: {
            apiBaseUrl: 'https://api.example.invalid'
          }
        }
      },
      {
        fetch: fetchMock as typeof fetch,
        Headers: globalThis.Headers
      }
    );

    await module.getProducts();

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      'https://api.example.invalid/products'
    );

    await expect(module.getOrders()).rejects.toThrow(
      /网页端暂不开放顾客交易/
    );

    expect(calls).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('web and miniapp payment modules contain no customer mark-paid fallback', () => {
    expect(source(
      'apps/storefront-web/src/lib/payment-transition.ts'
    )).not.toContain('markPaid');

    expect(source(
      'apps/storefront-web/src/lib/api.ts'
    )).not.toContain('/mark-paid');
  });
});
