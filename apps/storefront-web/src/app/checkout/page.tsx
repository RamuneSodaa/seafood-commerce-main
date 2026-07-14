'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import { AlertMessage, Badge, EmptyState, PageShell, PriceBlock, SectionCard } from '../../components/ui';
import { formatPriceCents, getProductInitials } from '../../lib/format';
import {
  createOrder,
  getCustomerAddresses,
  getStores,
  getProduct,
  previewOrderQuote,
  type CustomerAddress,
  type OrderQuotePreview,
  type ProductDetail,
  type StoreSummary
} from '../../lib/api';

type ShippingAddressForm = Omit<NonNullable<Parameters<typeof createOrder>[0]['shippingAddress']>, 'postalCode'> & {
  postalCode: string;
};

const EMPTY_SHIPPING_ADDRESS: ShippingAddressForm = {
  receiverName: '',
  phone: '',
  province: '',
  city: '',
  district: '',
  detail: '',
  postalCode: ''
};

function getCheckoutSubmitErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message === 'Invalid coupon code') {
    return '优惠券码无效，请检查后重试。';
  }

  return error instanceof Error ? error.message : '创建订单失败';
}

function isShippingAddressBlank(address: ShippingAddressForm): boolean {
  return !address.receiverName.trim() &&
    !address.phone.trim() &&
    !address.province.trim() &&
    !address.city.trim() &&
    !address.district.trim() &&
    !address.detail.trim() &&
    !address.postalCode.trim();
}

function CheckoutContent() {
  const query = useSearchParams();
  const router = useRouter();
  const productId = query.get('productId') || '';
  const presetSkuId = query.get('skuId') || '';

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [storeId, setStoreId] = useState('');
  const [skuId, setSkuId] = useState(presetSkuId);
  const [qty, setQty] = useState(1);
  const [fulfillmentType, setFulfillmentType] = useState<'STORE_PICKUP' | 'SHIPPING'>('STORE_PICKUP');
  const [error, setError] = useState('');
  const [submittingMessage, setSubmittingMessage] = useState('');
  const [productLoading, setProductLoading] = useState(true);
  const [storesLoading, setStoresLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [shippingAddress, setShippingAddress] = useState<ShippingAddressForm>(EMPTY_SHIPPING_ADDRESS);
  const [couponCode, setCouponCode] = useState('');
  const [quotePreview, setQuotePreview] = useState<OrderQuotePreview | null>(null);
  const [quoteError, setQuoteError] = useState('');
  const [defaultAddress, setDefaultAddress] = useState<CustomerAddress | null>(null);
  const [addressBookLoading, setAddressBookLoading] = useState(true);
  const [addressBookMessage, setAddressBookMessage] = useState('');
  const [hasTouchedShippingAddress, setHasTouchedShippingAddress] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function loadStores() {
      setStoresLoading(true);

      try {
        const data = await getStores();
        if (!isActive) return;
        setStores(data);
        setStoreId((current) => current || data[0]?.id || '');
      } catch (e) {
        if (isActive) {
          setError(e instanceof Error ? e.message : '加载门店失败');
        }
      } finally {
        if (isActive) {
          setStoresLoading(false);
        }
      }
    }

    loadStores();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadAddresses() {
      setAddressBookLoading(true);
      setAddressBookMessage('');

      try {
        const data = await getCustomerAddresses();
        if (!isActive) return;
        const nextDefaultAddress = data.find((address) => address.isDefault) || null;
        setDefaultAddress(nextDefaultAddress);
        if (!nextDefaultAddress) {
          setAddressBookMessage('当前还没有默认地址，本次下单可继续手动填写收货地址。');
        }
      } catch (e) {
        if (isActive) {
          setAddressBookMessage('默认地址读取失败，本次下单可继续手动填写收货地址。');
        }
      } finally {
        if (isActive) {
          setAddressBookLoading(false);
        }
      }
    }

    loadAddresses();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!productId) {
      setProductLoading(false);
      return;
    }

    let isActive = true;

    async function loadProduct() {
      setProductLoading(true);

      try {
        const data = await getProduct(productId);
        if (!isActive) return;
        setProduct(data);
        setSkuId((current) => current || data.skus?.[0]?.id || '');
      } catch (e) {
        if (isActive) {
          setError(e instanceof Error ? e.message : '加载商品失败');
        }
      } finally {
        if (isActive) {
          setProductLoading(false);
        }
      }
    }

    loadProduct();

    return () => {
      isActive = false;
    };
  }, [productId]);

  const activeSku = useMemo(
    () => product?.skus.find((sku) => sku.id === skuId) ?? product?.skus[0] ?? null,
    [product, skuId]
  );

  const selectedStore = useMemo(
    () => stores.find((store) => store.id === storeId) ?? null,
    [stores, storeId]
  );

  useEffect(() => {
    if (fulfillmentType !== 'SHIPPING') return;
    if (!defaultAddress) return;
    if (hasTouchedShippingAddress) return;

    setShippingAddress((current) => {
      if (!isShippingAddressBlank(current)) return current;

      return {
        receiverName: defaultAddress.receiverName,
        phone: defaultAddress.phone,
        province: defaultAddress.province,
        city: defaultAddress.city,
        district: defaultAddress.district,
        detail: defaultAddress.detail,
        postalCode: defaultAddress.postalCode || ''
      };
    });
  }, [defaultAddress, fulfillmentType, hasTouchedShippingAddress]);

  const trimmedShippingAddress = useMemo(
    () => ({
      receiverName: shippingAddress.receiverName.trim(),
      phone: shippingAddress.phone.trim(),
      province: shippingAddress.province.trim(),
      city: shippingAddress.city.trim(),
      district: shippingAddress.district.trim(),
      detail: shippingAddress.detail.trim(),
      postalCode: shippingAddress.postalCode.trim()
    }),
    [shippingAddress]
  );

  const missingShippingFields = useMemo(() => {
    const missing: string[] = [];

    if (!trimmedShippingAddress.receiverName) missing.push('收货人');
    if (!trimmedShippingAddress.phone) missing.push('联系电话');
    if (!trimmedShippingAddress.province) missing.push('省');
    if (!trimmedShippingAddress.city) missing.push('市');
    if (!trimmedShippingAddress.district) missing.push('区 / 区县');
    if (!trimmedShippingAddress.detail) missing.push('详细地址');

    return missing;
  }, [trimmedShippingAddress]);

  const hasCompleteShippingAddress = missingShippingFields.length === 0;
  const trimmedCouponCode = couponCode.trim();
  const totalAmountCents = (activeSku?.priceCents ?? 0) * qty;
  const isInitialLoading = productLoading || storesLoading;
  const canSubmit = Boolean(
    product &&
      activeSku &&
      storeId &&
      qty > 0 &&
      !submitting &&
      stores.length > 0 &&
      (fulfillmentType === 'STORE_PICKUP' || hasCompleteShippingAddress)
  );

  useEffect(() => {
    setQuotePreview(null);
    setQuoteError('');
  }, [storeId, skuId, qty, fulfillmentType, trimmedCouponCode]);

  async function handlePreviewQuote() {
    setQuoteError('');

    if (!storeId || !activeSku || qty < 1) {
      setQuoteError('请先选择门店、SKU 规格和有效数量，再预览价格。');
      return;
    }

    try {
      setPreviewLoading(true);
      const payload = {
        storeId,
        fulfillmentType,
        items: [{ skuId: activeSku.id, quantity: qty }],
        ...(trimmedCouponCode ? { couponCode: trimmedCouponCode } : {})
      };
      const nextPreview = await previewOrderQuote(payload);
      setQuotePreview(nextPreview);
    } catch (error) {
      setQuotePreview(null);
      setQuoteError(getCheckoutSubmitErrorMessage(error));
    } finally {
      setPreviewLoading(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmittingMessage('');

    if (!storeId || !activeSku || qty < 1) {
      setError('请选择门店、SKU 规格和有效数量。');
      return;
    }

    if (fulfillmentType === 'SHIPPING' && !hasCompleteShippingAddress) {
      setError(`请完整填写收货地址信息：${missingShippingFields.join('、')}。`);
      return;
    }

    try {
      setSubmitting(true);
      setSubmittingMessage('正在创建订单并准备下一步...');

      const payload: Parameters<typeof createOrder>[0] = {
        storeId,
        fulfillmentType,
        items: [{ skuId: activeSku.id, quantity: qty }]
      };

      if (trimmedCouponCode) {
        payload.couponCode = trimmedCouponCode;
      }

      if (fulfillmentType === 'STORE_PICKUP') {
        payload.pickupDate = new Date().toISOString();
        payload.pickupTimeSlot = '10:00-12:00';
      } else {
        payload.shippingAddress = {
          receiverName: trimmedShippingAddress.receiverName,
          phone: trimmedShippingAddress.phone,
          province: trimmedShippingAddress.province,
          city: trimmedShippingAddress.city,
          district: trimmedShippingAddress.district,
          detail: trimmedShippingAddress.detail,
          postalCode: trimmedShippingAddress.postalCode || undefined
        };
      }

      const created = await createOrder(payload);
      setSubmittingMessage('订单已创建，正在跳转到订单详情...');
      router.push(`/orders/${created.id}`);
    } catch (err) {
      setError(getCheckoutSubmitErrorMessage(err));
      setSubmitting(false);
      setSubmittingMessage('');
    }
  }

  if (!productId) {
    return (
      <PageShell
        eyebrow="下单"
        title="请先选择商品再下单"
        description="下单页需要先从商品详情带入商品和 SKU 规格，请返回商品页后重新进入。"
        breadcrumbs={[
          { label: '商品', href: '/' },
          { label: '下单' }
        ]}
        actions={
          <Link className="button" href="/">
            返回商品列表
          </Link>
        }
      >
        <EmptyState
          title="未选择商品"
          message="当前下单入口仍兼容既有 query 参数方式，因此 URL 中需要 `productId`，通常也会带上 `skuId`。"
          action={
            <div className="action-row">
              <Link className="button-secondary" href="/">
                浏览商品
              </Link>
            </div>
          }
        />
      </PageShell>
    );
  }

  return (
    <PageShell
      eyebrow="下单"
      title="确认订单信息后提交"
      description="确认商品、门店、履约方式与数量，并沿用现有下单流程完成提交。"
      breadcrumbs={[
        { label: '商品', href: '/' },
        ...(product ? [{ label: product.name, href: `/products/${product.id}` }] : []),
        { label: '下单' }
      ]}
      actions={
        <>
          <Link className="button-secondary" href={product ? `/products/${product.id}` : '/'}>
            返回商品详情
          </Link>
          <Link className="button-ghost" href="/orders">
            查看我的订单
          </Link>
        </>
      }
    >
      {error ? <AlertMessage title="下单信息需要处理" message={error} /> : null}
      {submittingMessage ? <AlertMessage title={submitting ? '正在提交订单' : '下单进度更新'} message={submittingMessage} /> : null}

      {isInitialLoading ? (
        <div className="checkout-grid">
          <section className="section-card">
            <div className="skeleton-card" />
          </section>
          <aside className="section-card">
            <div className="skeleton-card" />
          </aside>
        </div>
      ) : !product ? (
        <EmptyState
          title="商品不可用"
          message="当前无法加载所选商品，请返回商品页后重新进入下单。"
          action={
            <div className="action-row">
              <Link className="button" href="/">
                浏览商品
              </Link>
            </div>
          }
        />
      ) : (
        <div className="checkout-grid">
          <div className="checkout-main">
            <SectionCard
              title="已选商品"
              description="当前下单页保留既有 `productId` 与 `skuId` 参数方式，同时用更清晰的商品摘要展示当前选择。"
            >
              <div className="checkout-product">
                <div className="checkout-product-media">
                  <span className="checkout-product-initials" aria-hidden="true">
                    {getProductInitials(product.name)}
                  </span>
                </div>
                <div className="checkout-product-copy">
                  <div className="badge-row">
                    <Badge tone="accent">{product.skus.length} 个 SKU 规格</Badge>
                    <Badge tone="success">支持到店自提或邮寄发货</Badge>
                  </div>
                  <h2 className="product-title">{product.name}</h2>
                  <p className="muted-text">
                    {product.description?.trim() || '适合直接进入演示下单流程的海鲜商品。'}
                  </p>
                  {activeSku ? <PriceBlock label="当前 SKU 价格" amountCents={activeSku.priceCents} /> : null}
                </div>
              </div>
            </SectionCard>

            <form className="checkout-form" onSubmit={submit}>
              <SectionCard
                title="选择履约方式"
                description="在提交订单前先确认交付方式。显示层已中文化，但提交时仍会沿用原有 `fulfillmentType` 值。"
              >
                <div className="choice-grid">
                  <button
                    type="button"
                    className={`choice-card ${fulfillmentType === 'STORE_PICKUP' ? 'choice-card-active' : ''}`}
                    onClick={() => setFulfillmentType('STORE_PICKUP')}
                  >
                    <div className="choice-title-row">
                      <span className="choice-title">到店自提</span>
                      <Badge tone="accent">自提</Badge>
                    </div>
                    <p className="choice-copy">先锁定库存，再按默认提货时间到所选门店完成取货。</p>
                    <ul className="choice-points">
                      <li>适合门店附近顾客</li>
                      <li>默认提货时段自动带入</li>
                      <li>由门店人员完成备货</li>
                    </ul>
                  </button>

                  <button
                    type="button"
                    className={`choice-card ${fulfillmentType === 'SHIPPING' ? 'choice-card-active' : ''}`}
                    onClick={() => setFulfillmentType('SHIPPING')}
                  >
                    <div className="choice-title-row">
                      <span className="choice-title">邮寄发货</span>
                      <Badge tone="success">发货</Badge>
                    </div>
                    <p className="choice-copy">填写真实收货地址后提交订单，并按标准发货流程进入打包和配送。</p>
                    <ul className="choice-points">
                      <li>适合异地下单顾客</li>
                      <li>提交时冻结地址快照</li>
                      <li>进入发货履约流程</li>
                    </ul>
                  </button>
                </div>
              </SectionCard>

              <SectionCard
                title="订单信息"
                description="按门店、规格和数量分组展示，便于在提交前快速确认。"
              >
                <div className="form-stack">
                  <div className="field-grid">
                    <div>
                      <label className="field-label" htmlFor="store-select">
                        履约门店
                      </label>
                      <select
                        id="store-select"
                        className="select"
                        value={storeId}
                        onChange={(e) => setStoreId(e.target.value)}
                        disabled={stores.length === 0 || submitting}
                      >
                        {stores.map((store) => (
                          <option key={store.id} value={store.id}>
                            {store.name}
                          </option>
                        ))}
                      </select>
                      <p className="helper-text">
                        {selectedStore
                          ? `${selectedStore.name} · ${selectedStore.address}`
                          : '当前可选门店加载完成后会显示在这里。'}
                      </p>
                    </div>

                    <div>
                      <label className="field-label" htmlFor="sku-select">
                        SKU 规格
                      </label>
                      <select
                        id="sku-select"
                        className="select"
                        value={activeSku?.id ?? ''}
                        onChange={(e) => setSkuId(e.target.value)}
                        disabled={!product.skus.length || submitting}
                      >
                        {product.skus.map((sku) => (
                          <option key={sku.id} value={sku.id}>
                            {sku.name} - {formatPriceCents(sku.priceCents)}
                          </option>
                        ))}
                      </select>
                      <p className="helper-text">
                        下单页会兼容传入的 `skuId`，顾客也可以在提交前改选其他规格。
                      </p>
                    </div>
                  </div>

                  <div className="field-grid field-grid-compact">
                    <div>
                      <label className="field-label" htmlFor="qty-input">
                        数量
                      </label>
                      <input
                        id="qty-input"
                        className="input"
                        type="number"
                        min={1}
                        value={qty}
                        onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                        disabled={submitting}
                      />
                    </div>

                    <div>
                      <label className="field-label" htmlFor="coupon-code-input">
                        优惠券码
                      </label>
                      <input
                        id="coupon-code-input"
                        className="input"
                        type="text"
                        value={couponCode}
                        onChange={(e) => {
                          setCouponCode(e.target.value);
                          if (error) setError('');
                        }}
                        placeholder="可选，演示码如 WELCOME-1000"
                        disabled={submitting}
                      />
                      <p className="helper-text">本轮仅支持手动输入演示券码并随下单请求提交，不提供券列表、自动带券或预校验。</p>
                    </div>

                    <div className="checkout-note">
                      <span className="checkout-note-label">履约说明</span>
                      <p className="helper-text">
                        {fulfillmentType === 'STORE_PICKUP'
                          ? '当前演示逻辑仍会自动填充提货日期和时间段。'
                          : '请填写真实收货地址；提交时仍会沿用现有 shippingAddress snapshot 契约。'}
                      </p>
                    </div>
                  </div>
                </div>
              </SectionCard>

              {fulfillmentType === 'SHIPPING' ? (
                <SectionCard
                  title="收货地址"
                  description="该信息仅在邮寄发货时必填，提交后会按现有字段映射保存为订单地址快照。"
                >
                  <div className="form-stack">
                    <div className="field-grid">
                      <div>
                        <label className="field-label" htmlFor="receiver-name">
                          收货人
                        </label>
                        <input
                          id="receiver-name"
                          className="input"
                          type="text"
                          value={shippingAddress.receiverName}
                          onChange={(e) => {
                            setHasTouchedShippingAddress(true);
                            setShippingAddress((current) => ({ ...current, receiverName: e.target.value }));
                            if (error) setError('');
                          }}
                          disabled={submitting}
                        />
                      </div>

                      <div>
                        <label className="field-label" htmlFor="phone">
                          联系电话
                        </label>
                        <input
                          id="phone"
                          className="input"
                          type="text"
                          value={shippingAddress.phone}
                          onChange={(e) => {
                            setHasTouchedShippingAddress(true);
                            setShippingAddress((current) => ({ ...current, phone: e.target.value }));
                            if (error) setError('');
                          }}
                          disabled={submitting}
                        />
                      </div>
                    </div>

                    <div className="field-grid">
                      <div>
                        <label className="field-label" htmlFor="province">
                          省
                        </label>
                        <input
                          id="province"
                          className="input"
                          type="text"
                          value={shippingAddress.province}
                          onChange={(e) => {
                            setHasTouchedShippingAddress(true);
                            setShippingAddress((current) => ({ ...current, province: e.target.value }));
                            if (error) setError('');
                          }}
                          disabled={submitting}
                        />
                      </div>

                      <div>
                        <label className="field-label" htmlFor="city">
                          市
                        </label>
                        <input
                          id="city"
                          className="input"
                          type="text"
                          value={shippingAddress.city}
                          onChange={(e) => {
                            setHasTouchedShippingAddress(true);
                            setShippingAddress((current) => ({ ...current, city: e.target.value }));
                            if (error) setError('');
                          }}
                          disabled={submitting}
                        />
                      </div>
                    </div>

                    <div className="field-grid">
                      <div>
                        <label className="field-label" htmlFor="district">
                          区 / 区县
                        </label>
                        <input
                          id="district"
                          className="input"
                          type="text"
                          value={shippingAddress.district}
                          onChange={(e) => {
                            setHasTouchedShippingAddress(true);
                            setShippingAddress((current) => ({ ...current, district: e.target.value }));
                            if (error) setError('');
                          }}
                          disabled={submitting}
                        />
                      </div>

                      <div>
                        <label className="field-label" htmlFor="postal-code">
                          邮政编码（选填）
                        </label>
                        <input
                          id="postal-code"
                          className="input"
                          type="text"
                          value={shippingAddress.postalCode}
                          onChange={(e) => {
                            setHasTouchedShippingAddress(true);
                            setShippingAddress((current) => ({ ...current, postalCode: e.target.value }));
                            if (error) setError('');
                          }}
                          disabled={submitting}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="field-label" htmlFor="detail-address">
                        详细地址
                      </label>
                      <input
                        id="detail-address"
                        className="input"
                        type="text"
                        value={shippingAddress.detail}
                        onChange={(e) => {
                          setHasTouchedShippingAddress(true);
                          setShippingAddress((current) => ({ ...current, detail: e.target.value }));
                          if (error) setError('');
                        }}
                        disabled={submitting}
                      />
                    </div>

                    <div className="checkout-info-panel">
                      <h3 className="checkout-info-title">地址填写提示</h3>
                      <p className="helper-text">
                        必填项包括收货人、联系电话、省、市、区 / 区县和详细地址。切换到自提时不会清空已填写内容。
                      </p>
                      {addressBookLoading ? (
                        <p className="helper-text">正在读取默认地址...</p>
                      ) : defaultAddress && !hasTouchedShippingAddress ? (
                        <p className="helper-text">已自动带入默认地址，你也可以继续修改本次下单地址。</p>
                      ) : addressBookMessage ? (
                        <p className="helper-text">{addressBookMessage}</p>
                      ) : defaultAddress ? (
                        <p className="helper-text">当前默认地址已带入过，本次下单可继续使用你刚才修改后的地址。</p>
                      ) : null}
                      {!hasCompleteShippingAddress ? (
                        <p className="helper-text">当前还缺少：{missingShippingFields.join('、')}。</p>
                      ) : (
                        <p className="helper-text">地址信息已填写完整，提交时会映射到现有 shippingAddress 字段。</p>
                      )}
                    </div>
                  </div>
                </SectionCard>
              ) : null}

              <div className="action-row">
                <button className="button" type="submit" disabled={!canSubmit}>
                  {submitting ? '正在创建订单...' : '提交订单'}
                </button>
                <button className="button-secondary" type="button" disabled={previewLoading || submitting} onClick={handlePreviewQuote}>
                  {previewLoading ? '正在预览价格...' : '预览价格'}
                </button>
                <Link className="button-secondary" href={product ? `/products/${product.id}` : '/'}>
                  返回商品详情
                </Link>
              </div>
            </form>
          </div>

          <aside className="checkout-sidebar">
            <SectionCard
              title="订单摘要"
              description="提交前再次确认已选规格、数量、门店和履约方式。"
            >
              <div className="summary-stack">
                <PriceBlock label="预计合计" amountCents={totalAmountCents} />

                <div className="checkout-info-panel">
                  <h3 className="checkout-info-title">价格预览</h3>
                  {quoteError ? <p className="helper-text">{quoteError}</p> : null}
                  {!quotePreview && !quoteError ? <p className="helper-text">可在提交前手动预览当前券码下的订单金额。</p> : null}
                  {quotePreview ? (
                    <dl className="summary-list">
                      <div className="summary-row">
                        <dt>原价小计</dt>
                        <dd>{formatPriceCents(quotePreview.subtotalAmountCents)}</dd>
                      </div>
                      <div className="summary-row">
                        <dt>订单优惠</dt>
                        <dd>{formatPriceCents(quotePreview.discountAmountCents)}</dd>
                      </div>
                      <div className="summary-row">
                        <dt>实付金额</dt>
                        <dd>{formatPriceCents(quotePreview.totalAmountCents)}</dd>
                      </div>
                      <div className="summary-row">
                        <dt>生效券码</dt>
                        <dd>{quotePreview.appliedCouponCode?.trim() || '未使用优惠券'}</dd>
                      </div>
                    </dl>
                  ) : null}
                </div>

                <dl className="summary-list">
                  <div className="summary-row">
                    <dt>商品</dt>
                    <dd>{product.name}</dd>
                  </div>
                  <div className="summary-row">
                    <dt>SKU</dt>
                    <dd>{activeSku?.name || '未选择'}</dd>
                  </div>
                  <div className="summary-row">
                    <dt>数量</dt>
                    <dd>{qty}</dd>
                  </div>
                  <div className="summary-row">
                    <dt>门店</dt>
                    <dd>{selectedStore?.name || '未选择'}</dd>
                  </div>
                  <div className="summary-row">
                    <dt>履约方式</dt>
                    <dd>{fulfillmentType === 'STORE_PICKUP' ? '到店自提' : '邮寄发货'}</dd>
                  </div>
                  {fulfillmentType === 'SHIPPING' ? (
                    <>
                      <div className="summary-row">
                        <dt>收货人</dt>
                        <dd>{trimmedShippingAddress.receiverName || '未填写'}</dd>
                      </div>
                      <div className="summary-row">
                        <dt>联系电话</dt>
                        <dd>{trimmedShippingAddress.phone || '未填写'}</dd>
                      </div>
                      <div className="summary-row">
                        <dt>收货地址</dt>
                        <dd>
                          {hasCompleteShippingAddress
                            ? `${trimmedShippingAddress.province} ${trimmedShippingAddress.city} ${trimmedShippingAddress.district} ${trimmedShippingAddress.detail}`
                            : '请先完整填写收货地址'}
                        </dd>
                      </div>
                    </>
                  ) : null}
                </dl>

                <div className="checkout-info-panel">
                  <h3 className="checkout-info-title">提交后会发生什么</h3>
                  <p className="helper-text">
                    提交后，前台会通过当前 API 创建订单，并自动跳转到订单详情页继续后续操作。
                  </p>
                </div>
              </div>
            </SectionCard>
          </aside>
        </div>
      )}
    </PageShell>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <PageShell
          eyebrow="下单"
          title="正在准备下单页"
          description="正在加载所选商品、可用门店以及当前下单表单。"
          breadcrumbs={[
            { label: '商品', href: '/' },
            { label: '下单' }
          ]}
        >
          <div className="checkout-grid">
            <section className="section-card">
              <div className="skeleton-card" />
            </section>
            <aside className="section-card">
              <div className="skeleton-card" />
            </aside>
          </div>
        </PageShell>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
