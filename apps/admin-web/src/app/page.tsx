'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { AdminAlert, AdminPage, AdminSection } from '../components/admin-ui';
import { adminApi, storeApi, type InventoryRow, type OrderSummary, type ProductRow } from '../lib/api';
import { getInventorySummary } from '../lib/inventory';

const modules = [
  {
    title: '订单',
    href: '/workbench/orders',
    description: '处理自提与发货流程，跟进状态变化，并完成门店侧动作。'
  },
  {
    title: '库存',
    href: '/inventory',
    description: '查看实物、可售、预留库存关系，识别风险，并执行人工调整。'
  },
  {
    title: '商品管理',
    href: '/products',
    description: '查看商品状态、规格结构、价格区间与发布情况。'
  },
  {
    title: '门店',
    href: '/stores',
    description: '查看门店状态、联系方式，并进入相关库存和订单流程。'
  },
  {
    title: '操作日志',
    href: '/audit-logs',
    description: '查看商品与 SKU 关键操作（编辑/新增/发布/下架/停售）的审计记录与操作人。'
  }
];

function isToday(value: string): boolean {
  const target = new Date(value);
  const now = new Date();
  return target.getFullYear() === now.getFullYear() && target.getMonth() === now.getMonth() && target.getDate() === now.getDate();
}

function isPendingOrder(order: OrderSummary): boolean {
  return !['COMPLETED', 'DELIVERED', 'CANCELLED'].includes(order.status);
}

export default function AdminHome() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');

    try {
      const [orderRows, inventoryRows, productRows] = await Promise.all([
        storeApi.orders(),
        adminApi.inventory(),
        adminApi.products()
      ]);
      setOrders(orderRows);
      setInventory(inventoryRows);
      setProducts(productRows);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载控制台数据失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const inventorySummary = useMemo(() => getInventorySummary(inventory), [inventory]);
  const todayOrderCount = useMemo(() => orders.filter((order) => isToday(order.createdAt)).length, [orders]);
  const pendingOrderCount = useMemo(() => orders.filter(isPendingOrder).length, [orders]);
  const riskInventoryCount = inventorySummary.lowStockCount + inventorySummary.highReservedCount;
  const publishedProductCount = products.filter((product) => product.isPublished).length;

  return (
    <AdminPage
      eyebrow="后台总览"
      title="管理绿膳荟商城核心运营流程"
      description="控制台聚合今日订单、待处理事项、库存风险与已发布商品，帮助商家先看重点，再进入对应模块处理。"
      breadcrumbs={[{ label: '控制台首页' }]}
      actions={
        <div className="admin-hero-actions">
          <Link className="admin-button" href="/workbench/orders">
            打开订单作业台
          </Link>
          <Link className="admin-button-secondary" href="/inventory">
            查看库存
          </Link>
          <button className="admin-button-ghost" type="button" onClick={load} disabled={loading}>
            {loading ? '正在刷新...' : '刷新总览'}
          </button>
        </div>
      }
    >
      {error ? <AdminAlert title="控制台数据加载失败" message={error} /> : null}

      <div className="admin-metric-grid">
        <section className="admin-metric-card">
          <span className="admin-kpi-label">今日订单</span>
          <strong className="admin-kpi-value">{loading ? '...' : todayOrderCount}</strong>
          <p className="admin-helper">按下单时间统计今天新增订单。</p>
        </section>
        <section className="admin-metric-card">
          <span className="admin-kpi-label">待处理订单</span>
          <strong className="admin-kpi-value">{loading ? '...' : pendingOrderCount}</strong>
          <p className="admin-helper">包含待支付、待备货、待取货、待发货和配送中的订单。</p>
        </section>
        <section className="admin-metric-card admin-metric-card-warning">
          <span className="admin-kpi-label">库存风险</span>
          <strong className="admin-kpi-value">{loading ? '...' : riskInventoryCount}</strong>
          <p className="admin-helper">低库存或预留压力较高的库存记录，需要优先关注。</p>
        </section>
        <section className="admin-metric-card">
          <span className="admin-kpi-label">已发布商品</span>
          <strong className="admin-kpi-value">{loading ? '...' : publishedProductCount}</strong>
          <p className="admin-helper">当前可作为顾客端可售基础的已发布商品数量。</p>
        </section>
      </div>

      <AdminSection
        title="核心后台模块"
        description="模块入口保持清晰，让运营人员按订单、库存、商品、门店四条主线快速进入。"
      >
        <div className="admin-module-grid">
          {modules.map((module) => (
            <article key={module.href} className="admin-order-card admin-module-card">
              <div className="admin-title-stack">
                <h2 className="admin-section-title">{module.title}</h2>
                <p className="admin-helper">{module.description}</p>
              </div>
              <div className="admin-card-actions">
                <Link className="admin-button" href={module.href}>
                  进入{module.title}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </AdminSection>
    </AdminPage>
  );
}
