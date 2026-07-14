// Phase 2.52E：干货首页分类导航（纯前端 deterministic 映射，不写库、不改后端）。
// 目的：378 个干货商品原走后端精确 category 匹配（旧专题标签失配），改为前端稳定映射为
// 用户可用的一级导航分类。映射依据 = 后端 Product.category（主）+ 商品名关键词（拆分大类）。
// 该函数为纯函数、无副作用、结果稳定，可离线复算校验（见 review pack CATEGORY_COUNTS.md）。

// 导航分类顺序（含 2 个 meta：全部 / 今日推荐）。其余 11 个为真实商品分类。
export const DRY_NAV_CATEGORIES = [
  '全部',
  '今日推荐',
  '花胶鱼胶',
  '海参鲍肚',
  '元贝瑶柱',
  '海味干货',
  '参茸滋补',
  '菌菇干货',
  '花果茶草本',
  '枣莲百合',
  '坚果杂粮',
  '陈皮香料',
  '其他'
] as const;

export type DryNavCategory = (typeof DRY_NAV_CATEGORIES)[number];

function nameHas(name: string, keys: string[]): boolean {
  return keys.some((k) => name.includes(k));
}

// 将单个干货商品映射到 11 个真实分类之一（不含「全部」「今日推荐」两个 meta）。
export function classifyDryProduct(name: string, category?: string | null): DryNavCategory {
  const n = name || '';
  const c = (category || '').trim();

  if (c === '花胶类' || c === '花胶鱼胶') return '花胶鱼胶';
  if (c === '海参类') return '海参鲍肚';
  if (c === '滋补参类' || c === '黄芪、桑黄、灵芝、金线莲' || c === '石斛全系列') return '参茸滋补';
  if (c === '菌菇类') return '菌菇干货';
  if (c === '清热草本、花果茶、花叶类') return '花果茶草本';
  if (c === '陈皮' || c === '香料、调味') return '陈皮香料';

  if (c === '南北干货、杂粮、豆子、坚果') {
    if (nameHas(n, ['枣', '莲子', '百合', '枸杞', '杞', '桂圆', '龙眼', '银耳', '雪耳'])) return '枣莲百合';
    return '坚果杂粮';
  }

  if (c === '鲍鱼、元贝、瑶柱、蚝、鱿鱼、墨鱼、虾米、虾条、响螺、海产干货' || c === '滋补汤料') {
    if (nameHas(n, ['鲍'])) return '海参鲍肚';
    if (nameHas(n, ['元贝', '瑶柱', '干贝', '带子', '江珧'])) return '元贝瑶柱';
    return '海味干货';
  }

  if (c === '干贝瑶柱') return '元贝瑶柱';

  return '其他';
}
