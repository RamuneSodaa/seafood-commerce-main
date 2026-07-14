import { useState } from 'react';
import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro';
import { Button, Image, Text, View } from '@tarojs/components';

import homeHeroImage from '../../assets/brand/home-hero.jpg';
import serviceSelectImage from '../../assets/brand/service-select.jpg';
import serviceSoupImage from '../../assets/brand/service-soup.jpg';
import {
  getMemberMe,
  getMyCoupons,
  getReferralSummary,
  type CustomerCoupon,
  type MemberProfileSummary,
  type ReferralSummary
} from '../../lib/api';
import { redirectToCustomerLogin } from '../../lib/customer-login-redirect';
import { getStoredCustomerAuthArtifact } from '../../lib/identity-storage';

function getMemberLevelName(level?: string): string {
  switch (level) {
    case 'SILVER':
      return '银卡会员';
    case 'GOLD':
      return '金卡会员';
    default:
      return '普通会员';
  }
}

function isCouponUsable(coupon: CustomerCoupon): boolean {
  if (coupon.status && coupon.status !== 'CLAIMED') return false;
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) return false;
  return true;
}

export default function MemberPage() {
  const [memberProfile, setMemberProfile] = useState<MemberProfileSummary | null>(null);
  const [coupons, setCoupons] = useState<CustomerCoupon[]>([]);
  const [referralSummary, setReferralSummary] = useState<ReferralSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadMember() {
    if (!getStoredCustomerAuthArtifact()) {
      redirectToCustomerLogin('/pages/member/index');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const [memberData, couponData, referralData] = await Promise.all([
        getMemberMe(),
        getMyCoupons(),
        getReferralSummary()
      ]);
      setMemberProfile(memberData);
      setCoupons(couponData);
      setReferralSummary(referralData);
    } catch (e) {
      setError(e instanceof Error && /[\u4e00-\u9fa5]/.test(e.message)
        ? e.message
        : '会员信息加载失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  }

  useDidShow(() => {
    loadMember();
  });

  useShareAppMessage(() => ({
    title: '来绿膳荟领新人券，严选海味到店自提/邮寄发货',
    path: referralSummary?.inviteCode
      ? `/pages/products/index?inviteCode=${encodeURIComponent(referralSummary.inviteCode)}`
      : '/pages/products/index'
  }));

  const usableCouponCount = coupons.filter(isCouponUsable).length;

  return (
    <View className='page-fade-in' style={{ minHeight: '100vh', padding: '28rpx', background: '#fff8ea' }}>
      <View className='brand-page-hero brand-login-hero' style={{ marginBottom: '24rpx' }}>
        <Image className='brand-page-hero-bg' src={homeHeroImage} mode='aspectFill' />
        <View className='brand-page-hero-shade' />
        <View className='brand-page-hero-copy'>
          <Text className='brand-page-hero-kicker'>绿膳荟干货海味店</Text>
          <Text className='brand-page-hero-title'>会员中心</Text>
          <Text className='brand-page-hero-subtitle'>查看会员价、新人礼、优惠券和邀请有礼。</Text>
        </View>
      </View>

      {loading ? (
        <View className='ui-skeleton-card'>
          <Text style={{ display: 'block', fontSize: '28rpx', fontWeight: '700', color: '#17231c', marginBottom: '18rpx' }}>正在加载会员权益…</Text>
          <View className='ui-skeleton-line' style={{ width: '68%', marginBottom: '18rpx' }} />
          <View className='ui-skeleton-block' style={{ height: '170rpx' }} />
        </View>
      ) : error ? (
        <View style={{ padding: '28rpx', borderRadius: '24rpx', background: '#fdecec', border: '2rpx solid #f6c7c7' }}>
          <Text style={{ display: 'block', fontSize: '28rpx', color: '#9f2a1d', fontWeight: '800', marginBottom: '14rpx' }}>{error}</Text>
          <Button className='ui-pressable ui-primary-button' hoverClass='ui-pressable-hover' size='mini' type='primary' onClick={loadMember}>
            重试
          </Button>
        </View>
      ) : (
        <View style={{ display: 'flex', flexDirection: 'column', gap: '22rpx' }}>
          <View
            style={{
              padding: '30rpx',
              borderRadius: '28rpx',
              background: 'linear-gradient(135deg, #236b45, #174832)',
              boxShadow: '0 14rpx 34rpx rgba(35, 107, 69, 0.18)'
            }}
          >
            <Text style={{ display: 'block', fontSize: '24rpx', color: '#fff4d8', fontWeight: '800', marginBottom: '8rpx' }}>
              当前身份
            </Text>
            <Text style={{ display: 'block', fontSize: '44rpx', color: '#ffffff', fontWeight: '900', marginBottom: '12rpx' }}>
              {memberProfile?.isMember ? getMemberLevelName(memberProfile.memberLevel) : '待开通会员'}
            </Text>
            <Text style={{ display: 'block', fontSize: '25rpx', color: '#eaf6ee' }}>
              注册登录即开通，当前可用优惠券 {usableCouponCount} 张。
            </Text>
          </View>

          <View style={{ background: '#ffffff', borderRadius: '24rpx', padding: '28rpx', border: '2rpx solid #e8e0d3' }}>
            <Text style={{ display: 'block', fontSize: '32rpx', color: '#17231c', fontWeight: '900', marginBottom: '18rpx' }}>会员权益</Text>
            {[
              { title: '会员价', desc: '部分商品享会员专属价格。', image: serviceSoupImage },
              { title: '新人礼', desc: '新用户登录后自动获得新人优惠券。', image: serviceSelectImage },
              { title: '专属优惠券', desc: '可在我的优惠券中查看和使用。', image: serviceSelectImage },
              { title: '邀请有礼', desc: '好友首单完成后，邀请人可获得奖励券。', image: serviceSoupImage }
            ].map((item) => (
              <View key={item.title} style={{ display: 'flex', alignItems: 'center', gap: '16rpx', padding: '16rpx 0', borderBottom: '2rpx solid #f0eadf' }}>
                <Image style={{ width: '72rpx', height: '72rpx', borderRadius: '18rpx' }} src={item.image} mode='aspectFill' />
                <View style={{ flex: 1 }}>
                  <Text style={{ display: 'block', fontSize: '28rpx', color: '#17231c', fontWeight: '800', marginBottom: '6rpx' }}>{item.title}</Text>
                  <Text style={{ display: 'block', fontSize: '23rpx', color: '#6b7280' }}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={{ background: '#ffffff', borderRadius: '24rpx', padding: '28rpx', border: '2rpx solid #e8e0d3' }}>
            <Text style={{ display: 'block', fontSize: '32rpx', color: '#17231c', fontWeight: '900', marginBottom: '18rpx' }}>会员等级</Text>
            {[
              ['普通会员', '注册即开通，享会员价、新人券。'],
              ['银卡会员', '累计消费或订单数达标后开放，享更多会员价和每月券。'],
              ['金卡会员', '高等级权益预留，享专属券、生日礼和优先服务提醒。']
            ].map(([title, desc]) => (
              <View key={title} style={{ padding: '18rpx', borderRadius: '18rpx', background: title === getMemberLevelName(memberProfile?.memberLevel) ? '#eaf6ee' : '#fffdfa', border: '2rpx solid #e8e0d3', marginBottom: '14rpx' }}>
                <Text style={{ display: 'block', fontSize: '28rpx', color: '#17231c', fontWeight: '800', marginBottom: '6rpx' }}>{title}</Text>
                <Text style={{ display: 'block', fontSize: '23rpx', color: '#6b7280' }}>{desc}</Text>
              </View>
            ))}
          </View>

          <View style={{ display: 'flex', gap: '14rpx', flexWrap: 'wrap' }}>
            <Button className='ui-pressable ui-primary-button' hoverClass='ui-pressable-hover' style={{ flex: 1 }} type='primary' onClick={() => Taro.switchTab({ url: '/pages/products/index' })}>
              查看会员价商品
            </Button>
            <Button className='ui-pressable' hoverClass='ui-pressable-hover' style={{ flex: 1 }} onClick={() => Taro.navigateTo({ url: '/pages/coupons/index' })}>
              我的优惠券
            </Button>
          </View>

          <View style={{ background: '#fff4d8', borderRadius: '24rpx', padding: '28rpx', border: '2rpx solid #e8d4a8' }}>
            <Text style={{ display: 'block', fontSize: '30rpx', color: '#17231c', fontWeight: '900', marginBottom: '8rpx' }}>邀请有礼</Text>
            <Text style={{ display: 'block', fontSize: '24rpx', color: '#6b7280', marginBottom: '14rpx' }}>
              邀请码：{referralSummary?.inviteCode || '登录后生成'}；已邀请 {referralSummary?.invitedCount || 0} 人，已获得奖励 {referralSummary?.rewardedCount || 0} 次。
            </Text>
            <Text style={{ display: 'block', fontSize: '23rpx', color: '#6f4b16', marginBottom: '18rpx' }}>
              好友通过你的分享进入小程序并完成首单后，奖励券会自动发放。
            </Text>
            <Button className='ui-pressable ui-primary-button' hoverClass='ui-pressable-hover' type='primary' openType='share'>
              分享给好友
            </Button>
          </View>
        </View>
      )}
    </View>
  );
}
