'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

function getPageContext(pathname: string): string {
  if (pathname === '/') return '商品浏览';
  if (pathname.startsWith('/products/')) return '商品详情';
  if (pathname === '/checkout') return '下单';
  if (pathname === '/orders') return '订单列表';
  if (pathname.startsWith('/orders/')) return '订单详情';
  if (pathname === '/addresses') return '我的地址';
  return '前台商城';
}

export function StorefrontChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const pageContext = getPageContext(pathname);

  return (
    <div className="storefront-app-shell">
      <header className="storefront-header">
        <div className="storefront-header-inner">
          <div className="storefront-brand-block">
            <Link className="storefront-brand" href="/">
              <span className="storefront-brand-mark" aria-hidden="true">
                SF
              </span>
              <span className="storefront-brand-copy">
                <strong>海鲜商城</strong>
                <span>顾客下单与履约演示</span>
              </span>
            </Link>
          </div>

          <nav className="storefront-nav" aria-label="Storefront primary">
            <Link className={`storefront-nav-link ${pathname === '/' || pathname.startsWith('/products/') || pathname === '/checkout' ? 'storefront-nav-link-active' : ''}`} href="/">
              商品
            </Link>
            <Link className={`storefront-nav-link ${pathname.startsWith('/orders') ? 'storefront-nav-link-active' : ''}`} href="/orders">
              订单
            </Link>
            <Link className={`storefront-nav-link ${pathname === '/addresses' ? 'storefront-nav-link-active' : ''}`} href="/addresses">
              地址
            </Link>
          </nav>

          <div className="storefront-context">
            <span className="storefront-context-label">当前区域</span>
            <strong>{pageContext}</strong>
          </div>
        </div>
      </header>

      <div className="storefront-app-main">{children}</div>

      <footer className="storefront-footer">
        <div className="storefront-footer-inner">
          <span>海鲜商城演示版</span>
          <span>从浏览商品、提交订单到跟踪履约，完整串联顾客主链路。</span>
        </div>
      </footer>
    </div>
  );
}
