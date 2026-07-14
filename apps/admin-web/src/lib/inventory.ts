import type { InventoryRow } from './api';

export function getInventoryRiskMeta(row: InventoryRow): {
  label: string;
  tone: 'success' | 'accent' | 'danger' | 'neutral';
  description: string;
} {
  if (row.availableStock <= 0) {
    return {
      label: '无可售库存',
      tone: 'danger',
      description: '可售库存已为 0 或更低，当前 SKU 无法继续售卖。'
    };
  }

  if (row.availableStock <= row.safeStock) {
    return {
      label: '可售库存偏低',
      tone: 'danger',
      description: '可售库存已达到或低于安全库存阈值，需要及时关注。'
    };
  }

  if (row.reservedStock >= Math.max(1, row.availableStock)) {
    return {
      label: '预留压力较高',
      tone: 'accent',
      description: '预留库存相对可售库存占比较高，可能影响新的销售空间。'
    };
  }

  if (row.damagedStock > 0) {
    return {
      label: '存在残损库存',
      tone: 'accent',
      description: '当前存在残损库存，需要结合实物库存一起关注。'
    };
  }

  return {
    label: '库存状态健康',
    tone: 'success',
    description: '实物、可售与预留库存目前处于相对健康的区间。'
  };
}

export function getInventorySummary(rows: InventoryRow[]) {
  return {
    totalRows: rows.length,
    totalPhysical: rows.reduce((sum, row) => sum + row.physicalStock, 0),
    totalAvailable: rows.reduce((sum, row) => sum + row.availableStock, 0),
    totalReserved: rows.reduce((sum, row) => sum + row.reservedStock, 0),
    lowStockCount: rows.filter((row) => row.availableStock <= row.safeStock).length,
    highReservedCount: rows.filter((row) => row.reservedStock >= Math.max(1, row.availableStock)).length
  };
}

export function getInventoryRelationshipHint(row: InventoryRow): string {
  if (row.reservedStock > 0) {
    return '预留库存已经锁定给订单使用，不能再作为自由可售库存。';
  }
  if (row.availableStock < row.physicalStock) {
    return '当前并非全部实物库存都可售，建议检查预留或残损占用情况。';
  }
  return '可售库存与实物库存较为接近，说明该 SKU 当前仍具备较好的销售空间。';
}
