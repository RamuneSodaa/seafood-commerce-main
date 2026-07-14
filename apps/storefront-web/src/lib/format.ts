export function formatPriceCents(priceCents: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2
  }).format(priceCents / 100);
}

export function getStartingPriceCents(skus: Array<{ priceCents: number }>): number {
  if (skus.length === 0) return 0;
  return skus.reduce((lowest, sku) => Math.min(lowest, sku.priceCents), skus[0].priceCents);
}

export function getProductInitials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2);

  return letters || 'SF';
}
