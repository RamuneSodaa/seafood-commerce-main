import type { StoreRow } from './api';

export function getStoreStatusMeta(store: StoreRow): {
  label: string;
  tone: 'success' | 'danger';
  description: string;
} {
  if (store.isActive) {
    return {
      label: '营业中',
      tone: 'success',
      description: '当前门店可参与库存、下单与履约等运营流程。'
    };
  }

  return {
    label: '未启用',
    tone: 'danger',
    description: '当前门店未启用，建议确认是否还应参与库存与履约流程。'
  };
}

export function getStoreContactSummary(store: StoreRow): string {
  if (store.contactName && store.contactPhone) {
    return `${store.contactName} · ${store.contactPhone}`;
  }

  if (store.contactName) {
    return store.contactName;
  }

  if (store.contactPhone) {
    return store.contactPhone;
  }

  return '暂无联系方式';
}
