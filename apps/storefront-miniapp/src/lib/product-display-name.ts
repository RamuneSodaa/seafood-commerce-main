/**
 * 顾客端商品名显示净化。
 *
 * 背景：为了解决「重名 + 价格档」，内部把同名商品改成「商品名（1680级）」这类后缀做区分。
 * 这些「（数字+级）」只是内部区分用，不应展示给顾客。本 helper 仅用于**前端展示层**，
 * 不改 DB Product.name、不改 API 返回、不影响下单 productId/skuId/支付参数。
 *
 * 规则：
 * 1. 仅去掉结尾的中文全角括号价格级后缀：（<数字>级），如 （1680级）/（830级）/（380级）。
 * 2. 只去结尾这一种后缀，不动商品本身名字。
 * 3. 不影响正常规格词：250克 / 500克 / 12头 / 大号 / 小号 / 切片 / 条 / 片 等。
 * 4. 没有该后缀则原样返回（对鲜鱼名、普通名都是 no-op）。
 */
const PRICE_TIER_SUFFIX = /（\s*\d+\s*级\s*）\s*$/;

export function sanitizeProductDisplayName(name?: string | null): string {
  if (!name) return name ?? '';
  return name.replace(PRICE_TIER_SUFFIX, '').trim();
}

export default sanitizeProductDisplayName;
