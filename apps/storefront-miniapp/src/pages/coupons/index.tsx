import { useMemo, useState } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';

import { getMyCoupons, type CustomerCoupon } from '../../lib/api';
import { redirectToCustomerLogin } from '../../lib/customer-login-redirect';
import { getStoredCustomerAuthArtifact } from '../../lib/identity-storage';

type CouponTab = 'CLAIMED' | 'LOCKED' | 'USED' | 'EXPIRED';

const TABS: Array<{ key: CouponTab; label: string }> = [
  { key: 'CLAIMED', label: '可用' },
  { key: 'LOCKED', label: '待支付锁定' },
  { key: 'USED', label: '已使用' },
  { key: 'EXPIRED', label: '已过期' }
];

function formatPriceCents(amountCents: number): string {
  const value = (Number(amountCents) || 0) / 100;
  return `¥${value.toFixed(2)}`;
}

function formatDate(value?: string | null): string {
  if (!value) return '长期有效';

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

function getCouponTab(coupon: CustomerCoupon): CouponTab {
  if (coupon.status === 'LOCKED') return 'LOCKED';
  if (coupon.status === 'USED') return 'USED';
  if (coupon.status === 'EXPIRED' || coupon.status === 'VOID') return 'EXPIRED';
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) return 'EXPIRED';
  return 'CLAIMED';
}

function getDiscountText(coupon: CustomerCoupon): string {
  if (coupon.discountType === 'PERCENT_OFF' && coupon.discountPercent) {
    return `${coupon.discountPercent} 折`;
  }

  return formatPriceCents(coupon.discountAmountCents || 0);
}

function getThresholdText(coupon: CustomerCoupon): string {
  return coupon.thresholdAmountCents > 0
    ? `满 ${formatPriceCents(coupon.thresholdAmountCents)} 可用`
    : '无门槛';
}

function getStatusText(tab: CouponTab): string {
  switch (tab) {
    case 'LOCKED':
      return '待支付订单锁定';
    case 'USED':
      return '已使用';
    case 'EXPIRED':
      return '已过期';
    default:
      return '可用';
  }
}

function getCardTone(tab: CouponTab) {
  if (tab === 'LOCKED') {
    return { background: '#fff4d8', border: '#e8d4a8', color: '#6f4b16' };
  }

  if (tab === 'USED' || tab === 'EXPIRED') {
    return { background: '#f6f1e8', border: '#e8e0d3', color: '#6b7280' };
  }

  return { background: '#fffdfa', border: '#d8ead9', color: '#236b45' };
}

export default function CouponsPage() {
  const [activeTab, setActiveTab] = useState<CouponTab>('CLAIMED');
  const [coupons, setCoupons] = useState<CustomerCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadCoupons() {
    if (!getStoredCustomerAuthArtifact()) {
      redirectToCustomerLogin('/pages/coupons/index');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setCoupons(await getMyCoupons());
    } catch (e) {
      setError(e instanceof Error && /[\u4e00-\u9fa5]/.test(e.message)
        ? e.message
        : '优惠券加载失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  }

  useDidShow(() => {
    loadCoupons();
  });

  const groupedCoupons = useMemo(() => {
    return coupons.reduce<Record<CouponTab, CustomerCoupon[]>>((group, coupon) => {
      group[getCouponTab(coupon)].push(coupon);
      return group;
    }, {
      CLAIMED: [],
      LOCKED: [],
      USED: [],
      EXPIRED: []
    });
  }, [coupons]);

  const currentCoupons = groupedCoupons[activeTab];

  return (
    <View className='page-fade-in' style={{ minHeight: '100vh', padding: '28rpx', background: '#fff8ea' }}>
      <View
        style={{
          padding: '30rpx',
          borderRadius: '28rpx',
          background: 'linear-gradient(135deg, #eaf6ee, #fffdfa)',
          border: '2rpx solid #e8e0d3',
          marginBottom: '24rpx',
          boxShadow: '0 12rpx 30rpx rgba(35, 107, 69, 0.10)'
        }}
      >
        <Text style={{ display: 'block', fontSize: '24rpx', color: '#236b45', fontWeight: '800', marginBottom: '8rpx' }}>
          绿膳荟会员权益
        </Text>
        <Text style={{ display: 'block', fontSize: '42rpx', color: '#17231c', fontWeight: '900', marginBottom: '10rpx' }}>
          我的优惠券
        </Text>
        <Text style={{ display: 'block', fontSize: '25rpx', color: '#6b7280' }}>
          查看可用券、待支付锁定券和已使用记录。
        </Text>
      </View>

      <View style={{ display: 'flex', gap: '12rpx', overflowX: 'auto', marginBottom: '22rpx' }}>
        {TABS.map((tab) => (
          <View
            key={tab.key}
            className='ui-pressable'
            onClick={() => setActiveTab(tab.key)}
            style={{
              flexShrink: 0,
              padding: '14rpx 22rpx',
              borderRadius: '999rpx',
              background: activeTab === tab.key ? '#236b45' : '#fffdfa',
              border: activeTab === tab.key ? '2rpx solid #236b45' : '2rpx solid #e8e0d3'
            }}
          >
            <Text style={{ fontSize: '24rpx', color: activeTab === tab.key ? '#ffffff' : '#6b7280', fontWeight: '800' }}>
              {tab.label} {groupedCoupons[tab.key].length}
            </Text>
          </View>
        ))}
      </View>

      {loading ? (
        <View className='ui-skeleton-card'>
          <Text style={{ display: 'block', fontSize: '28rpx', fontWeight: '700', color: '#17231c', marginBottom: '18rpx' }}>正在加载优惠券…</Text>
          <View className='ui-skeleton-line' style={{ width: '70%', marginBottom: '18rpx' }} />
          <View className='ui-skeleton-block' style={{ height: '180rpx' }} />
        </View>
      ) : error ? (
        <View style={{ padding: '28rpx', borderRadius: '24rpx', background: '#fdecec', border: '2rpx solid #f6c7c7' }}>
          <Text style={{ display: 'block', fontSize: '28rpx', color: '#9f2a1d', fontWeight: '800', marginBottom: '14rpx' }}>{error}</Text>
          <Button className='ui-pressable ui-primary-button' hoverClass='ui-pressable-hover' size='mini' type='primary' onClick={loadCoupons}>
            重试
          </Button>
        </View>
      ) : currentCoupons.length === 0 ? (
        <View className='brand-empty-card'>
          <Text style={{ display: 'block', fontSize: '30rpx', color: '#17231c', fontWeight: '800', marginBottom: '12rpx' }}>
            当前没有{TABS.find((tab) => tab.key === activeTab)?.label}优惠券
          </Text>
          <Text style={{ display: 'block', fontSize: '25rpx', color: '#6b7280', marginBottom: '22rpx' }}>
            可以先去本店精选里挑选滋补干货海味。
          </Text>
          <Button className='ui-pressable ui-primary-button' hoverClass='ui-pressable-hover' size='mini' type='primary' onClick={() => Taro.switchTab({ url: '/pages/products/index' })}>
            去选商品
          </Button>
        </View>
      ) : (
        <View style={{ display: 'flex', flexDirection: 'column', gap: '18rpx' }}>
          {currentCoupons.map((coupon) => {
            const tab = getCouponTab(coupon);
            const tone = getCardTone(tab);

            return (
              <View
                key={coupon.id || coupon.templateId}
                style={{
                  padding: '24rpx',
                  borderRadius: '24rpx',
                  background: tone.background,
                  border: `2rpx solid ${tone.border}`,
                  boxShadow: '0 8rpx 24rpx rgba(23, 35, 28, 0.05)',
                  opacity: tab === 'USED' || tab === 'EXPIRED' ? 0.78 : 1
                }}
              >
                <View style={{ display: 'flex', justifyContent: 'space-between', gap: '20rpx', marginBottom: '14rpx' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ display: 'block', fontSize: '30rpx', color: '#17231c', fontWeight: '900', marginBottom: '8rpx' }}>
                      {coupon.name}
                    </Text>
                    <Text style={{ display: 'block', fontSize: '24rpx', color: '#6b7280' }}>
                      {getThresholdText(coupon)} · {coupon.canStack === false ? '不可叠加' : '可叠加'}
                    </Text>
                  </View>
                  <View style={{ minWidth: '148rpx', alignItems: 'flex-end' }}>
                    <Text style={{ display: 'block', textAlign: 'right', fontSize: '34rpx', color: '#d94836', fontWeight: '900' }}>
                      {getDiscountText(coupon)}
                    </Text>
                    <Text style={{ display: 'block', textAlign: 'right', fontSize: '22rpx', color: tone.color, fontWeight: '800' }}>
                      {getStatusText(tab)}
                    </Text>
                  </View>
                </View>
                <Text style={{ display: 'block', fontSize: '23rpx', color: '#6b7280', marginBottom: '8rpx' }}>
                  有效期：{formatDate(coupon.validFrom || coupon.claimedAt)} 至 {formatDate(coupon.expiresAt || coupon.validTo)}
                </Text>
                <Text style={{ display: 'block', fontSize: '23rpx', color: '#6b7280', marginBottom: '18rpx' }}>
                  适用范围：绿膳荟在售商品
                </Text>

                {tab === 'LOCKED' ? (
                  <Text style={{ display: 'block', fontSize: '23rpx', color: '#6f4b16', fontWeight: '700', marginBottom: '16rpx' }}>
                    该券已用于待支付订单，支付或取消订单后状态会更新。
                  </Text>
                ) : null}

                <View style={{ display: 'flex', gap: '14rpx', flexWrap: 'wrap' }}>
                  {tab === 'CLAIMED' ? (
                    <Button className='ui-pressable ui-primary-button' hoverClass='ui-pressable-hover' size='mini' type='primary' onClick={() => Taro.switchTab({ url: '/pages/products/index' })}>
                      去使用
                    </Button>
                  ) : null}
                  {tab === 'LOCKED' && coupon.lockedOrderId ? (
                    <Button className='ui-pressable ui-primary-button' hoverClass='ui-pressable-hover' size='mini' type='primary' onClick={() => Taro.navigateTo({ url: `/pages/order-detail/index?orderId=${coupon.lockedOrderId}` })}>
                      查看占用订单
                    </Button>
                  ) : null}
                  {tab === 'USED' && coupon.usedOrderId ? (
                    <Button className='ui-pressable' hoverClass='ui-pressable-hover' size='mini' onClick={() => Taro.navigateTo({ url: `/pages/order-detail/index?orderId=${coupon.usedOrderId}` })}>
                      查看使用订单
                    </Button>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
