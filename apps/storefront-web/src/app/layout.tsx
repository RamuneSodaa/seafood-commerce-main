import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { StorefrontChrome } from '../components/storefront-chrome';
import './globals.css';

export const metadata: Metadata = {
  title: '海鲜商城',
  description: '浏览海鲜商品，选择到店自提或邮寄发货，并完成演示下单。'
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="storefront-body">
        <StorefrontChrome>{children}</StorefrontChrome>
      </body>
    </html>
  );
}
