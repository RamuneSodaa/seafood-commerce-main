'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { adminApi, clearAdminSession, getStoredAdminProfile, getStoredAdminToken, type AdminProfile } from '../lib/api';

type NavItem = {
  label: string;
  href: string;
  match: (pathname: string) => boolean;
};

const navItems: NavItem[] = [
  { label: '首页', href: '/', match: (pathname) => pathname === '/' },
  { label: '订单', href: '/workbench/orders', match: (pathname) => pathname.startsWith('/workbench/orders') },
  { label: '库存', href: '/inventory', match: (pathname) => pathname.startsWith('/inventory') },
  { label: '商品管理', href: '/products', match: (pathname) => pathname.startsWith('/products') },
  { label: '门店', href: '/stores', match: (pathname) => pathname.startsWith('/stores') }
];

function getCurrentArea(pathname: string): string {
  if (pathname === '/') return '控制台总览';
  if (pathname.startsWith('/workbench/orders')) return '订单作业台';
  if (pathname.startsWith('/inventory')) return '库存作业台';
  if (pathname.startsWith('/products')) return '商品管理';
  if (pathname.startsWith('/stores')) return '门店管理';
  return '后台控制台';
}

export function AdminChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === '/login';
  const [checking, setChecking] = useState(!isLoginPage);
  const [profile, setProfile] = useState<AdminProfile | null>(null);

  useEffect(() => {
    if (isLoginPage) {
      setChecking(false);
      setProfile(null);
      return;
    }

    setChecking(true);
    const token = getStoredAdminToken();
    if (!token) {
      setChecking(false);
      router.replace('/login');
      return;
    }

    setProfile(getStoredAdminProfile());
    adminApi
      .me()
      .then((res) => setProfile(res.admin))
      .catch(() => {
        clearAdminSession();
        router.replace('/login');
      })
      .finally(() => setChecking(false));
  }, [isLoginPage, router]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (checking) {
    return (
      <div className="admin-app-shell">
        <div className="admin-app-main">
          <div className="admin-page">
            <section className="admin-section">
              <p className="admin-helper">正在确认后台登录状态...</p>
            </section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-app-shell">
      <header className="admin-header">
        <div className="admin-header-inner">
          <Link className="admin-brand" href="/">
            <span className="admin-brand-mark" aria-hidden="true">
              绿
            </span>
            <span className="admin-brand-copy">
              <strong>绿膳荟商家后台</strong>
              <span>订单、库存、商品与门店统一管理</span>
            </span>
          </Link>

          <nav className="admin-nav" aria-label="Admin primary">
            {navItems.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  className={`admin-nav-link ${active ? 'admin-nav-link-active' : ''}`}
                  href={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="admin-context">
            <span className="admin-context-label">当前模块</span>
            <strong>{getCurrentArea(pathname)}</strong>
          </div>
          <div className="admin-context">
            <span className="admin-context-label">当前账号</span>
            <strong>{profile?.displayName || '后台管理员'}</strong>
            <button
              className="admin-link-button"
              type="button"
              onClick={() => router.push('/account')}
            >
              修改密码
            </button>
            <button
              className="admin-link-button"
              type="button"
              onClick={() => {
                clearAdminSession();
                router.replace('/login');
              }}
            >
              退出登录
            </button>
          </div>
        </div>
      </header>

      <div className="admin-app-main">{children}</div>

      <footer className="admin-footer">
        <div className="admin-footer-inner">
          <span>绿膳荟商家后台</span>
          <span>通过导航在核心运营模块之间切换，完成订单、库存、商品与门店管理。</span>
        </div>
      </footer>
    </div>
  );
}
