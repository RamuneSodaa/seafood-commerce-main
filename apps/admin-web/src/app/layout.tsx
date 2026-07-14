import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { AdminChrome } from '../components/admin-chrome';
import './globals.css';

export const metadata: Metadata = {
  title: '绿膳荟商家后台',
  description: '用于管理绿膳荟商城订单、库存、商品与门店的运营后台。'
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="admin-layout-body">
        <AdminChrome>{children}</AdminChrome>
      </body>
    </html>
  );
}
