'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AlertMessage, Badge, EmptyState, LoadingGrid, PageShell, SectionCard } from '../../components/ui';
import { createCustomerAddress, getCustomerAddresses, setDefaultCustomerAddress, type CreateCustomerAddressPayload, type CustomerAddress } from '../../lib/api';

const EMPTY_ADDRESS_FORM: CreateCustomerAddressPayload = {
  receiverName: '',
  phone: '',
  province: '',
  city: '',
  district: '',
  detail: '',
  postalCode: ''
};

export default function AddressBookPage() {
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateCustomerAddressPayload>(EMPTY_ADDRESS_FORM);

  async function loadAddresses() {
    setLoading(true);
    setError('');

    try {
      const data = await getCustomerAddresses();
      setAddresses(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载地址列表失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAddresses();
  }, []);

  const trimmedForm = useMemo(
    () => ({
      receiverName: form.receiverName.trim(),
      phone: form.phone.trim(),
      province: form.province.trim(),
      city: form.city.trim(),
      district: form.district.trim(),
      detail: form.detail.trim(),
      postalCode: form.postalCode?.trim() || ''
    }),
    [form]
  );

  const missingFields = useMemo(() => {
    const missing: string[] = [];

    if (!trimmedForm.receiverName) missing.push('收货人');
    if (!trimmedForm.phone) missing.push('联系电话');
    if (!trimmedForm.province) missing.push('省');
    if (!trimmedForm.city) missing.push('市');
    if (!trimmedForm.district) missing.push('区 / 区县');
    if (!trimmedForm.detail) missing.push('详细地址');

    return missing;
  }, [trimmedForm]);

  const canSubmit = missingFields.length === 0 && !submitting && settingDefaultId === null;

  async function handleCreateAddress() {
    setError('');
    setFeedback('');

    if (missingFields.length > 0) {
      setError(`请先完整填写地址信息：${missingFields.join('、')}。`);
      return;
    }

    try {
      setSubmitting(true);
      await createCustomerAddress({
        receiverName: trimmedForm.receiverName,
        phone: trimmedForm.phone,
        province: trimmedForm.province,
        city: trimmedForm.city,
        district: trimmedForm.district,
        detail: trimmedForm.detail,
        postalCode: trimmedForm.postalCode || undefined
      });
      setForm(EMPTY_ADDRESS_FORM);
      await loadAddresses();
      setFeedback('地址已新增，列表已刷新。');
    } catch (e) {
      setError(e instanceof Error ? e.message : '新增地址失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSetDefault(id: string) {
    setError('');
    setFeedback('');

    try {
      setSettingDefaultId(id);
      await setDefaultCustomerAddress(id);
      await loadAddresses();
      setFeedback('默认地址已更新。');
    } catch (e) {
      setError(e instanceof Error ? e.message : '设置默认地址失败');
    } finally {
      setSettingDefaultId(null);
    }
  }

  return (
    <PageShell
      eyebrow="我的地址"
      title="管理常用收货地址"
      description="先维护顾客自己的最小地址簿，后续下单时可继续基于这些地址做默认带入。"
      breadcrumbs={[
        { label: '订单', href: '/orders' },
        { label: '我的地址' }
      ]}
      actions={
        <>
          <Link className="button-secondary" href="/orders">
            返回订单
          </Link>
          <Link className="button-ghost" href="/">
            继续逛商品
          </Link>
        </>
      }
    >
      {error ? <AlertMessage title="地址信息需要处理" message={error} /> : null}
      {feedback ? <AlertMessage title="地址簿更新" message={feedback} /> : null}

      <div className="checkout-grid">
        <div className="checkout-main">
          <SectionCard
            title="地址列表"
            description="这里展示当前顾客已保存的地址，并可以把其中一条设为默认地址。"
          >
            {loading ? (
              <LoadingGrid count={2} />
            ) : addresses.length === 0 ? (
              <EmptyState
                title="暂时还没有地址"
                message="先新增一条地址，后续可以把它设为默认地址并用于下单带入。"
              />
            ) : (
              <div className="order-list">
                {addresses.map((address) => (
                  <article key={address.id} className="order-card">
                    <div className="order-card-top">
                      <div className="order-card-heading">
                        <h2 className="product-title">{address.receiverName}</h2>
                        <p className="muted-text">{address.phone}</p>
                      </div>
                      <div className="badge-row">
                        {address.isDefault ? <Badge tone="success">默认地址</Badge> : <Badge>普通地址</Badge>}
                      </div>
                    </div>

                    <dl className="summary-list">
                      <div className="summary-row">
                        <dt>所在地区</dt>
                        <dd>{`${address.province} ${address.city} ${address.district}`}</dd>
                      </div>
                      <div className="summary-row">
                        <dt>详细地址</dt>
                        <dd>{address.detail}</dd>
                      </div>
                      <div className="summary-row">
                        <dt>邮政编码</dt>
                        <dd>{address.postalCode || '未填写'}</dd>
                      </div>
                    </dl>

                    <div className="card-actions">
                      <button
                        className={address.isDefault ? 'button-secondary' : 'button'}
                        type="button"
                        disabled={address.isDefault || settingDefaultId !== null || submitting}
                        onClick={() => handleSetDefault(address.id)}
                      >
                        {settingDefaultId === address.id ? '正在设置...' : address.isDefault ? '当前默认地址' : '设为默认地址'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <aside className="checkout-sidebar">
          <SectionCard
            title="新增地址"
            description="先支持最小地址录入，不引入复杂弹窗或多步骤交互。"
          >
            <div className="form-stack">
              <div>
                <label className="field-label" htmlFor="address-receiver-name">
                  收货人
                </label>
                <input
                  id="address-receiver-name"
                  className="input"
                  type="text"
                  value={form.receiverName}
                  onChange={(e) => setForm((current) => ({ ...current, receiverName: e.target.value }))}
                  disabled={submitting || settingDefaultId !== null}
                />
              </div>

              <div>
                <label className="field-label" htmlFor="address-phone">
                  联系电话
                </label>
                <input
                  id="address-phone"
                  className="input"
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))}
                  disabled={submitting || settingDefaultId !== null}
                />
              </div>

              <div className="field-grid">
                <div>
                  <label className="field-label" htmlFor="address-province">
                    省
                  </label>
                  <input
                    id="address-province"
                    className="input"
                    type="text"
                    value={form.province}
                    onChange={(e) => setForm((current) => ({ ...current, province: e.target.value }))}
                    disabled={submitting || settingDefaultId !== null}
                  />
                </div>

                <div>
                  <label className="field-label" htmlFor="address-city">
                    市
                  </label>
                  <input
                    id="address-city"
                    className="input"
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm((current) => ({ ...current, city: e.target.value }))}
                    disabled={submitting || settingDefaultId !== null}
                  />
                </div>
              </div>

              <div className="field-grid">
                <div>
                  <label className="field-label" htmlFor="address-district">
                    区 / 区县
                  </label>
                  <input
                    id="address-district"
                    className="input"
                    type="text"
                    value={form.district}
                    onChange={(e) => setForm((current) => ({ ...current, district: e.target.value }))}
                    disabled={submitting || settingDefaultId !== null}
                  />
                </div>

                <div>
                  <label className="field-label" htmlFor="address-postal-code">
                    邮政编码（选填）
                  </label>
                  <input
                    id="address-postal-code"
                    className="input"
                    type="text"
                    value={form.postalCode}
                    onChange={(e) => setForm((current) => ({ ...current, postalCode: e.target.value }))}
                    disabled={submitting || settingDefaultId !== null}
                  />
                </div>
              </div>

              <div>
                <label className="field-label" htmlFor="address-detail">
                  详细地址
                </label>
                <input
                  id="address-detail"
                  className="input"
                  type="text"
                  value={form.detail}
                  onChange={(e) => setForm((current) => ({ ...current, detail: e.target.value }))}
                  disabled={submitting || settingDefaultId !== null}
                />
              </div>

              <div className="checkout-info-panel">
                <h3 className="checkout-info-title">填写说明</h3>
                <p className="helper-text">
                  必填项包括收货人、联系电话、省、市、区 / 区县和详细地址。邮政编码可选。
                </p>
                {missingFields.length > 0 ? (
                  <p className="helper-text">当前还缺少：{missingFields.join('、')}。</p>
                ) : (
                  <p className="helper-text">地址信息已填写完整，可以直接新增。</p>
                )}
              </div>

              <div className="action-row">
                <button className="button" type="button" disabled={!canSubmit} onClick={handleCreateAddress}>
                  {submitting ? '正在新增地址...' : '新增地址'}
                </button>
              </div>
            </div>
          </SectionCard>
        </aside>
      </div>
    </PageShell>
  );
}
