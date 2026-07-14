import { useEffect, useMemo, useState } from 'react';
import Taro, { useRouter, useShareAppMessage } from '@tarojs/taro';
import { Button, Image, Text, View } from '@tarojs/components';

import emptyOrderImage from '../../assets/brand/empty-order.jpg';
import homeHeroImage from '../../assets/brand/home-hero.jpg';
import {
  bindReferral,
  claimCoupon,
  exchangeAuthReal,
  getClaimableCoupons,
  getMemberMe,
  getMyCoupons,
  getReferralSummary,
  verifyCustomerAuthArtifact,
  type CustomerCoupon,
  type MemberProfileSummary,
  type ReferralSummary
} from '../../lib/api';
import { clearPendingCustomerLoginRedirectUrl, getPendingCustomerLoginRedirectUrl } from '../../lib/customer-login-redirect';
import { getMiniappIdentitySource } from '../../lib/identity';
import {
  clearAllStoredCustomerIdentities,
  clearPendingInviteCode,
  clearStoredCustomerAuthArtifact,
  getPendingInviteCode,
  getStoredCustomerAuthArtifact,
  setStoredCustomerAuthArtifact
} from '../../lib/identity-storage';
import { handleMiniappLoginSuccess } from '../../lib/login-success-orchestrator';

const DEFAULT_REDIRECT_URL = '/pages/products/index';
const TAB_PAGE_URLS = new Set(['/pages/products/index', '/pages/catalog/index', '/pages/cart/index', '/pages/orders/index', '/pages/customer-login/index']);

function resolveRedirectUrl(value?: string): string {
  const trimmedValue = value?.trim();
  if (!trimmedValue) {
    return DEFAULT_REDIRECT_URL;
  }

  try {
    return decodeURIComponent(trimmedValue);
  } catch {
    return trimmedValue;
  }
}

function getReadableLoginErrorMessage(error: unknown): string {
  if (error instanceof Error && /[\u4e00-\u9fa5]/.test(error.message)) {
    return error.message;
  }

  return '微信登录暂未完成，请稍后重试。';
}

function navigateAfterLogin(url: string) {
  const path = url.split('?')[0];

  if (TAB_PAGE_URLS.has(path)) {
    Taro.switchTab({ url: path });
    return;
  }

  Taro.redirectTo({ url });
}

function isCouponReadyToUse(coupon: CustomerCoupon): boolean {
  if (coupon.status && coupon.status !== 'CLAIMED') {
    return false;
  }

  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) {
    return false;
  }

  return true;
}

export default function CustomerLoginPage() {
  const router = useRouter();
  const redirectUrl = resolveRedirectUrl(router.params?.redirect || getPendingCustomerLoginRedirectUrl());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [hasCompletedRealLogin, setHasCompletedRealLogin] = useState(
    getMiniappIdentitySource() === 'real-storage' && Boolean(getStoredCustomerAuthArtifact())
  );
  const [memberProfile, setMemberProfile] = useState<MemberProfileSummary | null>(null);
  const [myCoupons, setMyCoupons] = useState<CustomerCoupon[]>([]);
  const [claimableCoupons, setClaimableCoupons] = useState<CustomerCoupon[]>([]);
  const [referralSummary, setReferralSummary] = useState<ReferralSummary | null>(null);
  const [claimingCoupon, setClaimingCoupon] = useState(false);
  const usableCouponCount = useMemo(
    () => myCoupons.filter(isCouponReadyToUse).length,
    [myCoupons]
  );
  const lockedCouponCount = useMemo(
    () => myCoupons.filter((coupon) => coupon.status === 'LOCKED').length,
    [myCoupons]
  );
  const usedCouponCount = useMemo(
    () => myCoupons.filter((coupon) => coupon.status === 'USED').length,
    [myCoupons]
  );

  const pageCopy = useMemo(() => {
    if (hasCompletedRealLogin) {
      return '已完成微信登录，可以继续查看订单、提交订单并完成支付。';
    }

    return '请先完成微信登录，方便为你保存订单和自提信息。';
  }, [hasCompletedRealLogin]);

  async function loadMemberCenter() {
    if (!getStoredCustomerAuthArtifact()) return [];

    try {
      const [memberData, couponData, claimableData, referralData] = await Promise.all([
        getMemberMe(),
        getMyCoupons(),
        getClaimableCoupons(),
        getReferralSummary()
      ]);
      setMemberProfile(memberData);
      setMyCoupons(couponData);
      setClaimableCoupons(claimableData);
      setReferralSummary(referralData);
      return couponData;
    } catch (e) {
      console.warn('会员权益信息读取失败', e);
      return [];
    }
  }

  async function bindPendingInviteIfNeeded() {
    const pendingInviteCode = getPendingInviteCode();
    if (!pendingInviteCode) return;

    try {
      await bindReferral(pendingInviteCode);
      clearPendingInviteCode();
    } catch (e) {
      console.warn('邀请关系绑定未完成', e);
    }
  }

  useEffect(() => {
    if (!hasCompletedRealLogin) return;
    loadMemberCenter();
  }, [hasCompletedRealLogin]);

  useShareAppMessage(() => ({
    title: '来绿膳荟领新人券，严选海味到店自提/邮寄发货',
    path: referralSummary?.inviteCode
      ? `/pages/products/index?inviteCode=${encodeURIComponent(referralSummary.inviteCode)}`
      : '/pages/products/index'
  }));

  async function handleLogin() {
    setIsSubmitting(true);
    setFeedback('');
    setError('');

    try {
      const loginResult = await Taro.login();
      const loginCode = loginResult.code?.trim() || '';

      if (!loginCode) {
        throw new Error('微信登录暂未完成，请重试。');
      }

      const exchangedResult = await exchangeAuthReal({
        providerCode: loginCode,
        raw: {
          entry: 'customer-login-page',
          upstreamSource: 'taro.login'
        }
      });

      setStoredCustomerAuthArtifact(exchangedResult.authArtifact);
      handleMiniappLoginSuccess(exchangedResult);

      const storedAuthArtifact = getStoredCustomerAuthArtifact();
      if (!storedAuthArtifact) {
        throw new Error('登录状态保存失败，请重新登录。');
      }

      await verifyCustomerAuthArtifact(storedAuthArtifact);
      await bindPendingInviteIfNeeded();

      setHasCompletedRealLogin(true);
      const refreshedCoupons = await loadMemberCenter();
      setFeedback('登录成功，正在进入商城。');
      Taro.showToast({
        title: refreshedCoupons.some((coupon) => coupon.autoGrantOnNewUser && isCouponReadyToUse(coupon)) ? '新人优惠券已到账' : '登录成功',
        icon: 'success'
      });

      setTimeout(() => {
        clearPendingCustomerLoginRedirectUrl();
        navigateAfterLogin(redirectUrl);
      }, 500);
    } catch (nextError) {
      setError(getReadableLoginErrorMessage(nextError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogout() {
    const result = await Taro.showModal({
      title: '确认退出当前账号？',
      content: '退出后仍可浏览商品，订单、优惠券和会员权益需要重新登录后查看。',
      confirmText: '退出',
      cancelText: '取消'
    });

    if (!result.confirm) return;

    clearStoredCustomerAuthArtifact();
    clearAllStoredCustomerIdentities();
    clearPendingCustomerLoginRedirectUrl();

    setHasCompletedRealLogin(false);
    setMemberProfile(null);
    setMyCoupons([]);
    setClaimableCoupons([]);
    setReferralSummary(null);
    setFeedback('');
    setError('');

    Taro.showToast({ title: '已退出登录', icon: 'success' });
  }

  async function handleClaimFirstCoupon() {
    const firstCoupon = claimableCoupons[0];
    if (!firstCoupon) return;

    try {
      setClaimingCoupon(true);
      await claimCoupon({ templateCode: firstCoupon.code });
      Taro.showToast({ title: '优惠券已领取', icon: 'success' });
      await loadMemberCenter();
    } catch (e) {
      Taro.showToast({
        title: getReadableLoginErrorMessage(e),
        icon: 'none'
      });
    } finally {
      setClaimingCoupon(false);
    }
  }

  return (
    <View className='page-fade-in' style={{ minHeight: '100vh', padding: '24rpx', display: 'flex', flexDirection: 'column', gap: '24rpx', background: '#fff8ea' }}>
      <View className='brand-page-hero brand-login-hero'>
        <Image className='brand-page-hero-bg' src={homeHeroImage} mode='aspectFill' />
        <View className='brand-page-hero-shade' />
        <View className='brand-page-hero-copy'>
          <Text className='brand-page-hero-kicker'>绿膳荟干货海味店</Text>
          <Text className='brand-page-hero-title'>微信登录</Text>
          <Text className='brand-page-hero-subtitle'>{pageCopy}</Text>
        </View>
      </View>

      {error ? (
        <View
          style={{
            background: '#fff4d8',
            borderRadius: '24rpx',
            padding: '24rpx',
            border: '2rpx solid #e8d4a8'
          }}
        >
          <Text style={{ display: 'block', fontSize: '28rpx', fontWeight: '700', color: '#6f4b16', marginBottom: '8rpx' }}>登录未完成</Text>
          <Text style={{ display: 'block', fontSize: '26rpx', color: '#17231c' }}>{error}</Text>
        </View>
      ) : null}

      {feedback ? (
        <View
          style={{
            background: '#eaf6ee',
            borderRadius: '24rpx',
            padding: '24rpx',
            border: '2rpx solid #d8ead9'
          }}
        >
          <Text style={{ display: 'block', fontSize: '26rpx', color: '#236b45', fontWeight: '700' }}>{feedback}</Text>
        </View>
      ) : null}

      <View
        style={{
          background: '#ffffff',
          borderRadius: '24rpx',
          padding: '28rpx',
          boxShadow: '0 8rpx 24rpx rgba(23, 35, 28, 0.06)',
          border: '2rpx solid #e8e0d3'
        }}
      >
        <View className='login-brand-card'>
          <Image className='login-brand-image' src={emptyOrderImage} mode='aspectFill' />
          <View style={{ flex: 1 }}>
            <Text style={{ display: 'block', fontSize: '28rpx', fontWeight: '800', color: '#17231c', marginBottom: '6rpx' }}>
              登录后安心下单
            </Text>
            <Text style={{ display: 'block', fontSize: '23rpx', color: '#6b7280' }}>
              为你保存订单、自提门店与支付进度。
            </Text>
          </View>
        </View>
        <View style={{ display: 'flex', flexDirection: 'column', gap: '16rpx' }}>
          <Button
            className='ui-pressable ui-primary-button'
            hoverClass='ui-pressable-hover'
            type='primary'
            loading={isSubmitting}
            disabled={isSubmitting}
            onClick={handleLogin}
          >
            {isSubmitting ? '登录中' : hasCompletedRealLogin ? '重新登录' : '微信登录'}
          </Button>
          <Button className='ui-pressable' hoverClass='ui-pressable-hover' onClick={() => Taro.switchTab({ url: '/pages/products/index' })}>返回商品列表</Button>
          <Button className='ui-pressable' hoverClass='ui-pressable-hover' onClick={() => Taro.switchTab({ url: '/pages/orders/index' })}>查看我的订单</Button>
        </View>
      </View>

      {hasCompletedRealLogin ? (
        <View
          style={{
            background: '#ffffff',
            borderRadius: '24rpx',
            padding: '28rpx',
            boxShadow: '0 8rpx 24rpx rgba(23, 35, 28, 0.06)',
            border: '2rpx solid #e8e0d3'
          }}
        >
          <Text style={{ display: 'block', fontSize: '30rpx', fontWeight: '800', color: '#17231c', marginBottom: '8rpx' }}>我的权益</Text>
          <Text style={{ display: 'block', fontSize: '24rpx', color: '#6b7280', marginBottom: '18rpx' }}>
            登录即为绿膳荟会员，可享会员价、优惠券和邀请有礼。
          </Text>
          <Text style={{ display: 'block', fontSize: '24rpx', color: '#236b45', fontWeight: '700', marginBottom: '18rpx' }}>
            新人礼会在登录后自动放入你的账户。
          </Text>
          <View style={{ display: 'flex', gap: '14rpx', marginBottom: '18rpx' }}>
            <View
              className='ui-card-pressable'
              hoverClass='ui-card-pressable-hover'
              onClick={() => Taro.navigateTo({ url: '/pages/coupons/index' })}
              style={{
                flex: 1,
                minHeight: '150rpx',
                padding: '18rpx',
                borderRadius: '20rpx',
                background: '#fff4d8',
                border: '2rpx solid #ead7a8',
                boxShadow: '0 8rpx 18rpx rgba(111, 75, 22, 0.06)'
              }}
            >
              <Text style={{ display: 'block', fontSize: '24rpx', color: '#6f4b16', fontWeight: '700' }}>我的优惠券</Text>
              <Text style={{ display: 'block', fontSize: '28rpx', color: '#17231c', fontWeight: '800' }}>{usableCouponCount} 张可用</Text>
              <Text style={{ display: 'block', fontSize: '22rpx', color: '#6b7280', marginTop: '4rpx', lineHeight: '1.45' }}>
                共 {myCoupons.length} 张 · 锁定 {lockedCouponCount} 张 · 已用 {usedCouponCount} 张
              </Text>
              <Text style={{ display: 'block', fontSize: '22rpx', color: '#6f4b16', fontWeight: '700', marginTop: '8rpx' }}>查看优惠券详情</Text>
            </View>
            <View
              className='ui-card-pressable'
              hoverClass='ui-card-pressable-hover'
              onClick={() => Taro.navigateTo({ url: '/pages/member/index' })}
              style={{
                flex: 1,
                minHeight: '150rpx',
                padding: '18rpx',
                borderRadius: '20rpx',
                background: '#eaf6ee',
                border: '2rpx solid #d8ead9',
                boxShadow: '0 8rpx 18rpx rgba(35, 107, 69, 0.06)'
              }}
            >
              <Text style={{ display: 'block', fontSize: '24rpx', color: '#236b45', fontWeight: '700' }}>会员中心</Text>
              <Text style={{ display: 'block', fontSize: '28rpx', color: '#17231c', fontWeight: '800' }}>
                {memberProfile?.isMember ? '已开通' : '未开通'}
              </Text>
              <Text style={{ display: 'block', fontSize: '22rpx', color: '#6b7280', marginTop: '4rpx', lineHeight: '1.45' }}>会员价权益 · 等级预留</Text>
              <Text style={{ display: 'block', fontSize: '22rpx', color: '#236b45', fontWeight: '700', marginTop: '8rpx' }}>查看会员中心</Text>
            </View>
          </View>
          <View style={{ display: 'flex', gap: '14rpx' }}>
            <Button
              className='ui-pressable'
              hoverClass='ui-pressable-hover'
              style={{ flex: 1 }}
              onClick={() => Taro.navigateTo({ url: '/pages/coupons/index' })}
            >
              优惠券详情
            </Button>
            <Button
              className='ui-pressable'
              hoverClass='ui-pressable-hover'
              style={{ flex: 1 }}
              onClick={() => Taro.navigateTo({ url: '/pages/member/index' })}
            >
              会员中心
            </Button>
          </View>
          <View style={{ display: 'flex', gap: '14rpx', marginTop: '14rpx' }}>
            {claimableCoupons.length > 0 ? (
              <Button
                className='ui-pressable ui-primary-button'
                hoverClass='ui-pressable-hover'
                style={{ flex: 1 }}
                type='primary'
                loading={claimingCoupon}
                disabled={claimingCoupon}
                onClick={handleClaimFirstCoupon}
              >
                {claimingCoupon ? '领取中' : '领取可用优惠券'}
              </Button>
            ) : null}
            <Button
              className='ui-pressable'
              hoverClass='ui-pressable-hover'
              style={{ flex: 1 }}
              openType='share'
            >
              邀请有礼
            </Button>
          </View>
          {referralSummary?.inviteCode ? (
            <Text style={{ display: 'block', fontSize: '22rpx', color: '#6b7280', marginTop: '16rpx' }}>
              邀请码：{referralSummary.inviteCode}，好友首单完成后将发放奖励券。
            </Text>
          ) : null}
          <View style={{ marginTop: '22rpx', paddingTop: '18rpx', borderTop: '2rpx dashed #e8e0d3' }}>
            <Button
              className='ui-pressable'
              hoverClass='ui-pressable-hover'
              size='mini'
              plain
              style={{ width: '100%', borderColor: '#e8e0d3', color: '#6b7280', background: '#fffdfa' }}
              onClick={handleLogout}
            >
              退出当前账号
            </Button>
            <Text style={{ display: 'block', fontSize: '22rpx', color: '#9aa0a6', marginTop: '10rpx', textAlign: 'center' }}>
              仅清除本小程序登录态，不会影响你的微信账号。
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
