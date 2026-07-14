import { useState } from 'react';
import Taro from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';

import {
  createAuthenticatedOrder,
  createAuthenticatedCustomerAddress,
  exchangeAuthReal,
  getAuthenticatedCustomerAddresses,
  getAuthenticatedOrders,
  getProducts,
  getStores,
  setAuthenticatedCustomerAddressDefault,
  verifyCustomerAuthArtifact,
  type CreateOrderPayload,
  type CustomerAddress,
  type ProductSummary,
  type StoreSummary,
  type VerifiedCustomerAuthIdentity
} from '../../lib/api';
import { CURRENT_MINIAPP_PROFILE } from '../../lib/config';
import {
  handleMiniappLoginSuccess,
  type MiniappLoginSuccessPipelineResult
} from '../../lib/login-success-orchestrator';
import { resolveMiniappIdentity } from '../../lib/identity';
import {
  clearStoredCustomerAuthArtifact,
  getStoredCustomerAuthArtifact,
  setStoredCustomerAuthArtifact
} from '../../lib/identity-storage';

type RealAuthAttemptState = {
  loginCode: string;
  authArtifactPreview: string;
  provider: MiniappLoginSuccessPipelineResult['provider'];
  localResolvedIdentity: MiniappLoginSuccessPipelineResult['resolvedIdentity'];
  backendVerifiedIdentity: VerifiedCustomerAuthIdentity;
  addressCount?: number;
  firstAddressCustomerId?: string | null;
  createdAddressId?: string | null;
  createdAddressCustomerId?: string | null;
  defaultAddressId?: string | null;
  defaultAddressCustomerId?: string | null;
  orderCount?: number;
  firstOrderId?: string | null;
  firstOrderNo?: string | null;
  createdOrderId?: string | null;
  createdOrderNo?: string | null;
  createdOrderFulfillmentType?: string | null;
};

function cardStyle(background = '#ffffff') {
  return {
    background,
    borderRadius: '24rpx',
    padding: '28rpx',
    boxShadow: '0 8rpx 24rpx rgba(15, 23, 42, 0.06)'
  } as const;
}

function formatSourceLabel(source: MiniappLoginSuccessPipelineResult['resolvedIdentity']['source']): string {
  if (source === 'profile-env') {
    return 'profile / env override';
  }

  if (source === 'real-storage') {
    return 'real identity storage';
  }

  if (source === 'placeholder-storage') {
    return 'placeholder identity storage';
  }

  return 'demo fallback';
}

function formatAuthArtifactPreview(authArtifact: string): string {
  if (authArtifact.length <= 24) {
    return authArtifact;
  }

  return `${authArtifact.slice(0, 12)}...${authArtifact.slice(-12)}`;
}

function buildDevAddressPayload() {
  const now = Date.now().toString().slice(-6);

  return {
    receiverName: `开发顾客${now}`,
    phone: '13800000000',
    province: '浙江省',
    city: '杭州市',
    district: '西湖区',
    detail: `鉴权地址写入验证 ${now} 号`,
    postalCode: '310000'
  };
}

function mapCustomerAddressToShippingAddress(address: CustomerAddress): NonNullable<CreateOrderPayload['shippingAddress']> {
  return {
    receiverName: address.receiverName,
    phone: address.phone,
    province: address.province,
    city: address.city,
    district: address.district,
    detail: address.detail,
    postalCode: address.postalCode || undefined
  };
}

async function buildAuthenticatedDevOrderPayload() {
  const [products, stores] = await Promise.all([getProducts(), getStores()]);
  const store = stores[0];
  const product = products.find((item) => item.skus.length > 0 && (item.supportsPickup || item.supportsShipping));

  if (!store) {
    throw new Error('当前没有可用于 authenticated order create 的门店。');
  }

  if (!product) {
    throw new Error('当前没有可用于 authenticated order create 的可售商品。');
  }

  return buildAuthenticatedOrderPayloadForProduct(store, product);
}

async function buildAuthenticatedOrderPayloadForProduct(store: StoreSummary, product: ProductSummary): Promise<CreateOrderPayload> {
  const sku = product.skus[0];

  if (!sku) {
    throw new Error('当前商品没有可用于 authenticated order create 的 SKU。');
  }

  if (product.supportsPickup) {
    return {
      storeId: store.id,
      fulfillmentType: 'STORE_PICKUP',
      items: [{ skuId: sku.id, quantity: 1 }],
      pickupDate: new Date().toISOString(),
      pickupTimeSlot: '10:00-12:00'
    };
  }

  if (!product.supportsShipping) {
    throw new Error('当前商品不支持 authenticated order create 所需的履约方式。');
  }

  let addresses = await getAuthenticatedCustomerAddresses();
  let shippingAddress = addresses.find((address) => address.isDefault) || addresses[0];

  if (!shippingAddress) {
    shippingAddress = await createAuthenticatedCustomerAddress(buildDevAddressPayload());
    addresses = await getAuthenticatedCustomerAddresses();
    shippingAddress = addresses.find((address) => address.id === shippingAddress?.id) || shippingAddress;
  }

  return {
    storeId: store.id,
    fulfillmentType: 'SHIPPING',
    items: [{ skuId: sku.id, quantity: 1 }],
    shippingAddress: mapCustomerAddressToShippingAddress(shippingAddress)
  };
}

export default function DevAuthRealEntryPage() {
  const [attempt, setAttempt] = useState<RealAuthAttemptState | null>(null);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifyingStoredArtifact, setIsVerifyingStoredArtifact] = useState(false);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [isCreatingAddress, setIsCreatingAddress] = useState(false);
  const [isSettingDefaultAddress, setIsSettingDefaultAddress] = useState(false);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);

  async function runStoredArtifactVerification(options?: { tamperArtifact?: boolean }) {
    const storedAuthArtifact = getStoredCustomerAuthArtifact();

    if (!storedAuthArtifact) {
      throw new Error('当前没有可用的 authArtifact，请先完成一次 real auth 成功流程。');
    }

    const authArtifactToVerify = options?.tamperArtifact
      ? `${storedAuthArtifact.slice(0, -1)}${storedAuthArtifact.endsWith('x') ? 'y' : 'x'}`
      : storedAuthArtifact;

    return verifyCustomerAuthArtifact(authArtifactToVerify);
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    setAttempt(null);
    setFeedback('');
    setError('');

    try {
      const loginResult = await Taro.login();
      const loginCode = loginResult.code?.trim() || '';

      if (!loginCode) {
        throw new Error('miniapp real auth source 未返回 login code。');
      }

      try {
        const exchangedResult = await exchangeAuthReal({
          providerCode: loginCode,
          raw: {
            debugSource: 'dev-auth-real-entry-page',
            upstreamSource: 'taro.login'
          }
        });
        setStoredCustomerAuthArtifact(exchangedResult.authArtifact);
        const nextResult = handleMiniappLoginSuccess(exchangedResult);
        const storedAuthArtifact = getStoredCustomerAuthArtifact();

        if (!storedAuthArtifact) {
          throw new Error('authArtifact 已返回，但本地存储失败。');
        }

        const backendVerifiedIdentity = await verifyCustomerAuthArtifact(storedAuthArtifact);
        const addresses = await getAuthenticatedCustomerAddresses();

        setAttempt({
          loginCode,
          authArtifactPreview: formatAuthArtifactPreview(storedAuthArtifact),
          provider: nextResult.provider,
          localResolvedIdentity: nextResult.resolvedIdentity,
          backendVerifiedIdentity,
          addressCount: addresses.length,
          firstAddressCustomerId: addresses[0]?.customerId || null
        });
        setFeedback(
          `miniapp real auth source 已获取 login code，并已完成 authArtifact 本地存储、local identity 写入、后端验证，以及并行受保护 customer route seam（GET /customer/addresses/authenticated）调用。`
        );
      } catch (requestError) {
        const message = requestError instanceof Error ? requestError.message : 'real auth exchange 请求失败';
        setError(`miniapp login code 已获取，但 /auth/exchange-real 请求失败：${message}`);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'miniapp real auth source 调用失败');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyStoredArtifact() {
    setIsVerifyingStoredArtifact(true);
    setError('');

    try {
      const backendVerifiedIdentity = await runStoredArtifactVerification();

      setFeedback(
        `已使用本地存储的 authArtifact 完成后端验证，backend authenticated customer 为 ${backendVerifiedIdentity.role} / ${backendVerifiedIdentity.userId}。`
      );
      setAttempt((currentAttempt) =>
        currentAttempt
          ? {
              ...currentAttempt,
              authArtifactPreview: formatAuthArtifactPreview(getStoredCustomerAuthArtifact() || ''),
              backendVerifiedIdentity
            }
          : {
              loginCode: 'stored-artifact-probe',
              authArtifactPreview: formatAuthArtifactPreview(getStoredCustomerAuthArtifact() || ''),
              provider: 'wechat',
              localResolvedIdentity: resolveMiniappIdentity(),
              backendVerifiedIdentity
            }
      );
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '使用已存储 authArtifact 验证失败');
    } finally {
      setIsVerifyingStoredArtifact(false);
    }
  }

  async function handleVerifyTamperedArtifact() {
    setIsVerifyingStoredArtifact(true);
    setError('');
    setFeedback('');

    try {
      await runStoredArtifactVerification({ tamperArtifact: true });
      setError('篡改后的 authArtifact 意外通过了后端验证。');
    } catch (nextError) {
      setError(nextError instanceof Error ? `篡改 artifact 验证失败：${nextError.message}` : '篡改 artifact 验证失败');
    } finally {
      setIsVerifyingStoredArtifact(false);
    }
  }

  function handleClearStoredArtifact() {
    clearStoredCustomerAuthArtifact();
    setFeedback('本地 authArtifact 已清空。');
    setError('');
    setAttempt((currentAttempt) => (currentAttempt ? { ...currentAttempt, authArtifactPreview: '当前为空' } : null));
  }

  async function handleLoadCustomerAddresses() {
    setIsLoadingAddresses(true);
    setError('');

    try {
      const addresses = await getAuthenticatedCustomerAddresses();
      setFeedback(`已通过受保护的 customer read seam 获取地址列表，共 ${addresses.length} 条。`);
      setAttempt((currentAttempt) =>
        currentAttempt
          ? {
              ...currentAttempt,
              authArtifactPreview: formatAuthArtifactPreview(getStoredCustomerAuthArtifact() || ''),
              addressCount: addresses.length,
              firstAddressCustomerId: addresses[0]?.customerId || null
            }
          : currentAttempt
      );
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? `authenticated customer addresses 请求失败：${nextError.message}`
          : 'authenticated customer addresses 请求失败'
      );
    } finally {
      setIsLoadingAddresses(false);
    }
  }

  async function handleCreateAuthenticatedAddress() {
    setIsCreatingAddress(true);
    setError('');

    try {
      const createdAddress = await createAuthenticatedCustomerAddress(buildDevAddressPayload());
      const addresses = await getAuthenticatedCustomerAddresses();

      setFeedback(`已通过受保护的 customer write seam 新增地址，并重新读取受保护地址列表，共 ${addresses.length} 条。`);
      setAttempt((currentAttempt) =>
        currentAttempt
          ? {
              ...currentAttempt,
              authArtifactPreview: formatAuthArtifactPreview(getStoredCustomerAuthArtifact() || ''),
              addressCount: addresses.length,
              firstAddressCustomerId: addresses[0]?.customerId || null,
              createdAddressId: createdAddress.id,
              createdAddressCustomerId: createdAddress.customerId
            }
          : currentAttempt
      );
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? `authenticated customer address create 请求失败：${nextError.message}`
          : 'authenticated customer address create 请求失败'
      );
    } finally {
      setIsCreatingAddress(false);
    }
  }

  async function handleSetAuthenticatedDefaultAddress() {
    setIsSettingDefaultAddress(true);
    setError('');

    try {
      let addresses = await getAuthenticatedCustomerAddresses();

      while (addresses.length < 2) {
        await createAuthenticatedCustomerAddress(buildDevAddressPayload());
        addresses = await getAuthenticatedCustomerAddresses();
      }

      const candidateAddress = addresses.find((address) => !address.isDefault);

      if (!candidateAddress) {
        throw new Error('当前没有可切换为默认地址的 authenticated address，请先新增第二条地址。');
      }

      const updatedDefaultAddress = await setAuthenticatedCustomerAddressDefault(candidateAddress.id);
      const nextAddresses = await getAuthenticatedCustomerAddresses();

      setFeedback(`已通过受保护的 customer default seam 设置默认地址，并重新读取受保护地址列表，共 ${nextAddresses.length} 条。`);
      setAttempt((currentAttempt) =>
        currentAttempt
          ? {
              ...currentAttempt,
              authArtifactPreview: formatAuthArtifactPreview(getStoredCustomerAuthArtifact() || ''),
              addressCount: nextAddresses.length,
              firstAddressCustomerId: nextAddresses[0]?.customerId || null,
              defaultAddressId: updatedDefaultAddress.id,
              defaultAddressCustomerId: updatedDefaultAddress.customerId
            }
          : currentAttempt
      );
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? `authenticated customer address set-default 请求失败：${nextError.message}`
          : 'authenticated customer address set-default 请求失败'
      );
    } finally {
      setIsSettingDefaultAddress(false);
    }
  }

  async function handleLoadAuthenticatedOrders() {
    setIsLoadingOrders(true);
    setError('');

    try {
      const orders = await getAuthenticatedOrders();
      setFeedback(`已通过受保护的 order read seam 获取订单列表，共 ${orders.length} 条。`);
      setAttempt((currentAttempt) =>
        currentAttempt
          ? {
              ...currentAttempt,
              authArtifactPreview: formatAuthArtifactPreview(getStoredCustomerAuthArtifact() || ''),
              orderCount: orders.length,
              firstOrderId: orders[0]?.id || null,
              firstOrderNo: orders[0]?.orderNo || null
            }
          : currentAttempt
      );
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? `authenticated orders 请求失败：${nextError.message}`
          : 'authenticated orders 请求失败'
      );
    } finally {
      setIsLoadingOrders(false);
    }
  }

  async function handleCreateAuthenticatedOrder() {
    setIsCreatingOrder(true);
    setError('');

    try {
      const payload = await buildAuthenticatedDevOrderPayload();
      const createdOrder = await createAuthenticatedOrder(payload);
      const orders = await getAuthenticatedOrders();

      setFeedback(`已通过受保护的 order create seam 创建订单 ${createdOrder.orderNo}，并重新读取受保护订单列表，共 ${orders.length} 条。`);
      setAttempt((currentAttempt) =>
        currentAttempt
          ? {
              ...currentAttempt,
              authArtifactPreview: formatAuthArtifactPreview(getStoredCustomerAuthArtifact() || ''),
              orderCount: orders.length,
              firstOrderId: orders[0]?.id || null,
              firstOrderNo: orders[0]?.orderNo || null,
              createdOrderId: createdOrder.id,
              createdOrderNo: createdOrder.orderNo,
              createdOrderFulfillmentType: createdOrder.fulfillmentType
            }
          : currentAttempt
      );
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? `authenticated order create 请求失败：${nextError.message}`
          : 'authenticated order create 请求失败'
      );
    } finally {
      setIsCreatingOrder(false);
    }
  }

  return (
    <View style={{ minHeight: '100vh', padding: '24rpx', display: 'flex', flexDirection: 'column', gap: '24rpx' }}>
      <View style={cardStyle()}>
        <Text style={{ display: 'block', fontSize: '24rpx', color: '#2563eb', marginBottom: '12rpx' }}>开发调试</Text>
        <Text style={{ display: 'block', fontSize: '40rpx', fontWeight: '700', marginBottom: '12rpx' }}>Real Auth Dev Entry</Text>
        <Text style={{ display: 'block', fontSize: '26rpx', color: '#475569' }}>
          这个页面只用于开发调试时验证 miniapp real auth source 到 `/auth/exchange-real` 再进入现有 login success pipeline 的路径，不代表完整生产登录、token 或 session 已落地。
        </Text>
      </View>

      {error ? (
        <View style={cardStyle('#fff7ed')}>
          <Text style={{ display: 'block', fontSize: '28rpx', fontWeight: '600', marginBottom: '8rpx' }}>real auth entry 处理失败</Text>
          <Text style={{ display: 'block', fontSize: '26rpx', color: '#7c2d12' }}>{error}</Text>
        </View>
      ) : null}

      {feedback ? (
        <View style={cardStyle('#eff6ff')}>
          <Text style={{ display: 'block', fontSize: '28rpx', fontWeight: '600', marginBottom: '8rpx', color: '#1d4ed8' }}>real auth entry 处理结果</Text>
          <Text style={{ display: 'block', fontSize: '26rpx', color: '#1d4ed8' }}>{feedback}</Text>
        </View>
      ) : null}

      <View style={cardStyle()}>
        <Text style={{ display: 'block', fontSize: '32rpx', fontWeight: '700', marginBottom: '18rpx' }}>当前入口职责</Text>
        <View style={{ display: 'flex', flexDirection: 'column', gap: '12rpx' }}>
          <Text style={{ fontSize: '24rpx', color: '#475569' }}>当前 profile：{CURRENT_MINIAPP_PROFILE.name}</Text>
          <Text style={{ fontSize: '24rpx', color: '#475569' }}>
            本页只调用 `Taro.login()` 获取上游 login code，然后提交到 `/auth/exchange-real`。
          </Text>
          <Text style={{ fontSize: '24rpx', color: '#475569' }}>
            只有当后端真实返回有效的 `AuthSuccessResult` 与 `authArtifact` 时，本页才会继续进入现有 `auth result mapper -> login success orchestrator -> real identity write adapter`。
          </Text>
          <Text style={{ fontSize: '24rpx', color: '#475569' }}>
            随后本页还会使用已存储的 `authArtifact` 调用 `/auth/verify-customer-artifact`，明确区分 local real identity 与 backend verified authenticated customer。
          </Text>
          <Text style={{ fontSize: '24rpx', color: '#475569' }}>
            当前还会继续调用并行受保护的 `GET /customer/addresses/authenticated`、`POST /customer/addresses/authenticated` 与 `POST /customer/addresses/:id/set-default/authenticated`，在不破坏旧共享路由的前提下验证 customer address read / write / default seam。
          </Text>
          <Text style={{ fontSize: '24rpx', color: '#475569' }}>
            当前还会继续调用并行受保护的 `GET /orders/authenticated` 与 `POST /orders/authenticated`，在不触碰支付或其他订单迁移的前提下验证 order read / create seam。
          </Text>
          <Text style={{ fontSize: '24rpx', color: '#475569' }}>
            如果 `Taro.login()`、`/auth/exchange-real`、artifact 验证或 authenticated address 请求失败，本页都会明确报错，不会回退到 placeholder success。
          </Text>
        </View>
      </View>

      <View style={cardStyle()}>
        <Text style={{ display: 'block', fontSize: '32rpx', fontWeight: '700', marginBottom: '18rpx' }}>触发 real auth dev entry</Text>
        <View style={{ display: 'flex', flexDirection: 'column', gap: '16rpx' }}>
          <Button type='primary' loading={isSubmitting} disabled={isSubmitting} onClick={handleSubmit}>
            {isSubmitting ? '请求中...' : '调用 miniapp real auth source'}
          </Button>
          <Text style={{ fontSize: '24rpx', color: '#475569' }}>
            触发后会先请求微信 miniapp login source，再把最小 payload 发到 `/auth/exchange-real`。
          </Text>
          <View style={{ display: 'flex', gap: '16rpx', flexWrap: 'wrap' }}>
            <Button loading={isVerifyingStoredArtifact} disabled={isVerifyingStoredArtifact} onClick={handleVerifyStoredArtifact}>
              验证当前 authArtifact
            </Button>
            <Button loading={isVerifyingStoredArtifact} disabled={isVerifyingStoredArtifact} onClick={handleVerifyTamperedArtifact}>
              验证篡改 artifact
            </Button>
            <Button loading={isLoadingAddresses} disabled={isLoadingAddresses} onClick={handleLoadCustomerAddresses}>
              验证 authenticated addresses
            </Button>
            <Button loading={isCreatingAddress} disabled={isCreatingAddress} onClick={handleCreateAuthenticatedAddress}>
              验证 authenticated address create
            </Button>
            <Button loading={isSettingDefaultAddress} disabled={isSettingDefaultAddress} onClick={handleSetAuthenticatedDefaultAddress}>
              验证 authenticated address default
            </Button>
            <Button loading={isLoadingOrders} disabled={isLoadingOrders} onClick={handleLoadAuthenticatedOrders}>
              验证 authenticated orders
            </Button>
            <Button loading={isCreatingOrder} disabled={isCreatingOrder} onClick={handleCreateAuthenticatedOrder}>
              验证 authenticated order create
            </Button>
            <Button onClick={handleClearStoredArtifact}>清空 authArtifact</Button>
          </View>
        </View>
      </View>

      <View style={cardStyle()}>
        <Text style={{ display: 'block', fontSize: '32rpx', fontWeight: '700', marginBottom: '18rpx' }}>最近一次 real auth 结果</Text>
        {attempt ? (
          <View style={{ display: 'flex', flexDirection: 'column', gap: '12rpx' }}>
            <Text style={{ fontSize: '26rpx', color: '#475569' }}>login code：{attempt.loginCode}</Text>
            <Text style={{ fontSize: '26rpx', color: '#475569' }}>authArtifact：{attempt.authArtifactPreview}</Text>
            <Text style={{ fontSize: '26rpx', color: '#475569' }}>provider：{attempt.provider}</Text>
            <Text style={{ fontSize: '26rpx', color: '#475569' }}>
              local resolved identity：{`${attempt.localResolvedIdentity.identity.role} / ${attempt.localResolvedIdentity.identity.userId}`}
            </Text>
            <Text style={{ fontSize: '26rpx', color: '#475569' }}>
              local resolved source：{formatSourceLabel(attempt.localResolvedIdentity.source)}
            </Text>
            <Text style={{ fontSize: '26rpx', color: '#475569' }}>
              backend verified identity：
              {` ${attempt.backendVerifiedIdentity.role} / ${attempt.backendVerifiedIdentity.userId}`}
            </Text>
            <Text style={{ fontSize: '26rpx', color: '#475569' }}>authenticated addresses count：{attempt.addressCount ?? '尚未验证'}</Text>
            <Text style={{ fontSize: '26rpx', color: '#475569' }}>
              first address customerId：{attempt.firstAddressCustomerId ?? '尚未验证或当前为空'}
            </Text>
            <Text style={{ fontSize: '26rpx', color: '#475569' }}>created address id：{attempt.createdAddressId ?? '尚未验证'}</Text>
            <Text style={{ fontSize: '26rpx', color: '#475569' }}>
              created address customerId：{attempt.createdAddressCustomerId ?? '尚未验证'}
            </Text>
            <Text style={{ fontSize: '26rpx', color: '#475569' }}>default address id：{attempt.defaultAddressId ?? '尚未验证'}</Text>
            <Text style={{ fontSize: '26rpx', color: '#475569' }}>
              default address customerId：{attempt.defaultAddressCustomerId ?? '尚未验证'}
            </Text>
            <Text style={{ fontSize: '26rpx', color: '#475569' }}>authenticated orders count：{attempt.orderCount ?? '尚未验证'}</Text>
            <Text style={{ fontSize: '26rpx', color: '#475569' }}>first order id：{attempt.firstOrderId ?? '尚未验证或当前为空'}</Text>
            <Text style={{ fontSize: '26rpx', color: '#475569' }}>first order no：{attempt.firstOrderNo ?? '尚未验证或当前为空'}</Text>
            <Text style={{ fontSize: '26rpx', color: '#475569' }}>created order id：{attempt.createdOrderId ?? '尚未验证'}</Text>
            <Text style={{ fontSize: '26rpx', color: '#475569' }}>created order no：{attempt.createdOrderNo ?? '尚未验证'}</Text>
            <Text style={{ fontSize: '26rpx', color: '#475569' }}>
              created order fulfillment：{attempt.createdOrderFulfillmentType ?? '尚未验证'}
            </Text>
          </View>
        ) : (
          <Text style={{ fontSize: '24rpx', color: '#475569' }}>尚未触发 real auth dev entry。</Text>
        )}
      </View>

      <View style={{ display: 'flex', gap: '16rpx', flexWrap: 'wrap' }}>
        <Button onClick={() => Taro.navigateTo({ url: '/pages/dev-auth-entry/index' })}>打开 placeholder auth entry</Button>
        <Button onClick={() => Taro.navigateTo({ url: '/pages/dev-identity/index' })}>返回身份调试</Button>
        <Button onClick={() => Taro.navigateTo({ url: '/pages/products/index' })}>返回商品列表</Button>
      </View>
    </View>
  );
}
