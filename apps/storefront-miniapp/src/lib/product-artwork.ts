// 商品封面图集中映射（Phase 2.37A 重构）。
// 原本 products / product-detail / cart / checkout 各自维护一套重复的商品名→封面图 if 分支，
// 现统一集中到此模块，避免新增/替换图片时多页面不一致。
// 匹配顺序与原逻辑完全一致：专属图优先于通用 fallback；鸡蛋胶先于通用“胶”；
// 光秃参先于海参 fallback；章鱼/墨鱼先于鱿鱼；太子参先于党参/西洋参。
// 已隐藏商品（红参/鳕鱼胶/海味汤料组合/干贝瑶柱/精选花胶筒）不在此恢复，不引入红参专属图。

import productFishmawCoverImage from '../assets/brand/product-fishmaw-cover.jpg';
import productScallopCoverImage from '../assets/brand/product-scallop-cover.jpg';
import productSoupCoverImage from '../assets/brand/product-soup-cover.jpg';
import productYellowFishMawCoverImage from '../assets/products/product_yellow_fish_maw_cover.jpg';
import productMinFishMawKingCoverImage from '../assets/products/product_min_fish_maw_king_cover.jpg';
import productDalianSeaCucumberCoverImage from '../assets/products/product_dalian_sea_cucumber_cover.jpg';
import productThornKingSeaCucumberCoverImage from '../assets/products/product_thorn_king_sea_cucumber_cover.jpg';
import productAbalone12HeadCoverImage from '../assets/products/product_abalone_12head_cover.jpg';
import productAmericanGinsengCoverImage from '../assets/products/product_american_ginseng_cover.jpg';
import productMorelMushroomCoverImage from '../assets/products/product_morel_mushroom_cover.jpg';
import productDriedTangerinePeelCoverImage from '../assets/products/product_dried_tangerine_peel_cover.jpg';
import productDendrobiumCoverImage from '../assets/products/product_dendrobium_cover.jpg';
import productSnowFungusCoverImage from '../assets/products/product_snow_fungus_cover.jpg';
import productDriedSquidCoverImage from '../assets/products/product_dried_squid_cover.jpg';
import productDriedShrimpCoverImage from '../assets/products/product_dried_shrimp_cover.jpg';
import productTianqiCoverImage from '../assets/products/product_tianqi_cover.jpg';
import productBaiheCoverImage from '../assets/products/product_baihe_cover.jpg';
import productHongzaoCoverImage from '../assets/products/product_hongzao_cover.jpg';
import productHoutouguCoverImage from '../assets/products/product_houtougu_cover.jpg';
import productChashuguCoverImage from '../assets/products/product_chashugu_cover.jpg';
import productXiangluopianCoverImage from '../assets/products/product_xiangluopian_cover.jpg';
import productShengshaihaoCoverImage from '../assets/products/product_shengshaihao_cover.jpg';
import productDangshenCoverImage from '../assets/products/product_dangshen_cover.jpg';
import productLianziCoverImage from '../assets/products/product_lianzi_cover.jpg';
import productEggFishMawCoverImage from '../assets/products/product_egg_fish_maw_cover.jpg';
import productBaldSeaCucumberCoverImage from '../assets/products/product_bald_sea_cucumber_cover.jpg';
import productOctopusCoverImage from '../assets/products/product_octopus_cover.jpg';
import productCuttlefishCoverImage from '../assets/products/product_cuttlefish_cover.jpg';
import productTaizishenCoverImage from '../assets/products/product_taizishen_cover.jpg';
// Phase 2.49L-a：新鲜渔产统一占位图（中性，不冒充具体鱼种，不写价格/名称）。
import freshProductPlaceholder from '../assets/brand/fresh/fresh_product_placeholder.png';
// Phase 2.49L-b：正式 fresh 单品图（DB coverImageUrl 存稳定 key 文件名，前台据此 import 解析；不写 Mac 路径/鱼店图片路径）。
import freshWildMayouFish from '../assets/products/fresh/fresh_wild_mayou_fish_cover.png';
import freshWildGoldenPompano from '../assets/products/fresh/fresh_wild_golden_pompano_cover.png';
import freshWildFlowerShrimp from '../assets/products/fresh/fresh_wild_flower_shrimp_cover.png';
import freshWildHailangFish from '../assets/products/fresh/fresh_wild_hailang_fish_cover.png';
import freshWildOctopus from '../assets/products/fresh/fresh_wild_octopus_cover.png';
import freshWildOyster from '../assets/products/fresh/fresh_wild_oyster_cover.png';
import freshWildYellowtail from '../assets/products/fresh/fresh_wild_yellowtail_cover.png';
import freshWildSquid from '../assets/products/fresh/fresh_wild_squid_cover.png';
import freshWildSmallJiuShrimp from '../assets/products/fresh/fresh_wild_small_jiu_shrimp_cover.png';
import freshWildLargePrawn from '../assets/products/fresh/fresh_wild_large_prawn_cover.png';
import freshWildGoldenThreadfinBream from '../assets/products/fresh/fresh_wild_golden_threadfin_bream_cover.png';
import freshWildSoleFish from '../assets/products/fresh/fresh_wild_sole_fish_cover.png';
// Phase 2.49L-d1：剩余 22 个 fresh 单品图（同样只写稳定 key 到 DB，前台 import 解析）。
import freshWildDamicangFish from '../assets/products/fresh/fresh_wild_damicang_fish_cover.png';
import freshWildSpottedRabbitfish from '../assets/products/fresh/fresh_wild_spotted_rabbitfish_cover.png';
import freshWildYellowSandWhiting from '../assets/products/fresh/fresh_wild_yellow_sand_whiting_cover.png';
import freshWildDouchangPomfret from '../assets/products/fresh/fresh_wild_douchang_pomfret_cover.png';
import freshWildMingdinggongFish from '../assets/products/fresh/fresh_wild_mingdinggong_fish_cover.png';
import freshWildCrimsonSnapper from '../assets/products/fresh/fresh_wild_crimson_snapper_cover.png';
import freshWildMixedFish from '../assets/products/fresh/fresh_wild_mixed_fish_cover.png';
import freshWildSongyuFish from '../assets/products/fresh/fresh_wild_songyu_fish_cover.png';
import freshWildNiyuFish from '../assets/products/fresh/fresh_wild_niyu_fish_cover.png';
import freshWildHongyouSnapper from '../assets/products/fresh/fresh_wild_hongyou_snapper_cover.png';
import freshWildQiyuFish from '../assets/products/fresh/fresh_wild_qiyu_fish_cover.png';
import freshWildLayuFish from '../assets/products/fresh/fresh_wild_layu_fish_cover.png';
import freshWildSweetlips from '../assets/products/fresh/fresh_wild_sweetlips_cover.png';
import freshWildTiejiaJack from '../assets/products/fresh/fresh_wild_tiejia_jack_cover.png';
import freshWildGreenGrouper from '../assets/products/fresh/fresh_wild_green_grouper_cover.png';
import freshWildGreenWrasse from '../assets/products/fresh/fresh_wild_green_wrasse_cover.png';
import freshWildFilefish from '../assets/products/fresh/fresh_wild_filefish_cover.png';
import freshWildScorpionfish from '../assets/products/fresh/fresh_wild_scorpionfish_cover.png';
import freshWildStonefish from '../assets/products/fresh/fresh_wild_stonefish_cover.png';
import freshWildCoralTrout from '../assets/products/fresh/fresh_wild_coral_trout_cover.png';
import freshWildLongtailPomfret from '../assets/products/fresh/fresh_wild_longtail_pomfret_cover.png';
import freshWildJilongcangFish from '../assets/products/fresh/fresh_wild_jilongcang_fish_cover.png';

export type ProductArtwork = { title: string; subtitle: string; coverSrc: string };

// Phase 2.49L-b：fresh 单品图 key→已 import 模块映射（key 即 DB coverImageUrl，稳定文件名）。
const FRESH_COVER_ASSET_MAP: Record<string, string> = {
  'fresh_wild_mayou_fish_cover.png': freshWildMayouFish,
  'fresh_wild_golden_pompano_cover.png': freshWildGoldenPompano,
  'fresh_wild_flower_shrimp_cover.png': freshWildFlowerShrimp,
  'fresh_wild_hailang_fish_cover.png': freshWildHailangFish,
  'fresh_wild_octopus_cover.png': freshWildOctopus,
  'fresh_wild_oyster_cover.png': freshWildOyster,
  'fresh_wild_yellowtail_cover.png': freshWildYellowtail,
  'fresh_wild_squid_cover.png': freshWildSquid,
  'fresh_wild_small_jiu_shrimp_cover.png': freshWildSmallJiuShrimp,
  'fresh_wild_large_prawn_cover.png': freshWildLargePrawn,
  'fresh_wild_golden_threadfin_bream_cover.png': freshWildGoldenThreadfinBream,
  'fresh_wild_sole_fish_cover.png': freshWildSoleFish,
  // Phase 2.49L-d1：剩余 22 个
  'fresh_wild_damicang_fish_cover.png': freshWildDamicangFish,
  'fresh_wild_spotted_rabbitfish_cover.png': freshWildSpottedRabbitfish,
  'fresh_wild_yellow_sand_whiting_cover.png': freshWildYellowSandWhiting,
  'fresh_wild_douchang_pomfret_cover.png': freshWildDouchangPomfret,
  'fresh_wild_mingdinggong_fish_cover.png': freshWildMingdinggongFish,
  'fresh_wild_crimson_snapper_cover.png': freshWildCrimsonSnapper,
  'fresh_wild_mixed_fish_cover.png': freshWildMixedFish,
  'fresh_wild_songyu_fish_cover.png': freshWildSongyuFish,
  'fresh_wild_niyu_fish_cover.png': freshWildNiyuFish,
  'fresh_wild_hongyou_snapper_cover.png': freshWildHongyouSnapper,
  'fresh_wild_qiyu_fish_cover.png': freshWildQiyuFish,
  'fresh_wild_layu_fish_cover.png': freshWildLayuFish,
  'fresh_wild_sweetlips_cover.png': freshWildSweetlips,
  'fresh_wild_tiejia_jack_cover.png': freshWildTiejiaJack,
  'fresh_wild_green_grouper_cover.png': freshWildGreenGrouper,
  'fresh_wild_green_wrasse_cover.png': freshWildGreenWrasse,
  'fresh_wild_filefish_cover.png': freshWildFilefish,
  'fresh_wild_scorpionfish_cover.png': freshWildScorpionfish,
  'fresh_wild_stonefish_cover.png': freshWildStonefish,
  'fresh_wild_coral_trout_cover.png': freshWildCoralTrout,
  'fresh_wild_longtail_pomfret_cover.png': freshWildLongtailPomfret,
  'fresh_wild_jilongcang_fish_cover.png': freshWildJilongcangFish
};

export const FRESH_PRODUCT_PLACEHOLDER = freshProductPlaceholder;

// Phase 2.49L-a/b：新鲜渔产封面选择——**绝不**走 getProductArtwork(按名匹配干货图)。
// 解析顺序：空→占位图；http(s)→直接用；已知本地 key→对应 import 图；未知 key→占位图（不报错、不 fallback 干货图）。
export function getFreshProductCover(coverImageUrl?: string | null): string {
  const url = (coverImageUrl ?? '').trim();
  if (url.length === 0) return freshProductPlaceholder;
  if (/^https?:\/\//i.test(url)) return url;
  const key = url.replace(/^.*\//, ''); // 容错：若误带路径，仅取文件名
  return FRESH_COVER_ASSET_MAP[key] ?? freshProductPlaceholder;
}

export function getProductArtwork(productName: string): ProductArtwork {
  // ── scallop / 大元贝 / 干贝瑶柱 ─────────────────
  if (productName.includes('海味汤料组合')) return { title: '滋补汤料', subtitle: '家庭煲汤', coverSrc: productSoupCoverImage };
  if (productName.includes('干贝瑶柱')) return { title: '鲜香瑶柱', subtitle: '煲粥炖汤', coverSrc: productScallopCoverImage };
  if (productName.includes('大元贝')) return { title: '大元贝', subtitle: '鲜甜浓郁', coverSrc: productScallopCoverImage };

  // ── fish maw / 花胶鱼胶 ────────────────────────
  if (productName.includes('黄花胶')) return { title: '黄花胶', subtitle: '色泽自然', coverSrc: productYellowFishMawCoverImage };
  if (productName.includes('鳘鱼胶')) return { title: '鳘鱼胶', subtitle: '肉厚胶足', coverSrc: productMinFishMawKingCoverImage };
  if (productName.includes('鸡蛋胶')) return { title: '鸡蛋胶', subtitle: '胶质细腻', coverSrc: productEggFishMawCoverImage };
  if (productName.includes('花胶')) return { title: '精选花胶', subtitle: '滋补炖汤', coverSrc: productFishmawCoverImage };
  if (productName.includes('胶')) return { title: '海味鱼胶', subtitle: '滋补炖汤', coverSrc: productFishmawCoverImage };

  // ── sea cucumber / 海参 ────────────────────────
  if (productName.includes('大连辽参')) return { title: '大连辽参', subtitle: '海味珍品', coverSrc: productDalianSeaCucumberCoverImage };
  if (productName.includes('靓辽参')) return { title: '靓辽参', subtitle: '海味珍品', coverSrc: productDalianSeaCucumberCoverImage };
  if (productName.includes('光秃参')) return { title: '光秃参', subtitle: '家常炖煮', coverSrc: productBaldSeaCucumberCoverImage };
  if (productName.includes('刺王参')) return { title: '刺王参', subtitle: '参体饱满', coverSrc: productThornKingSeaCucumberCoverImage };
  if (productName.includes('小刺参')) return { title: '小刺参', subtitle: '家常炖煮', coverSrc: productThornKingSeaCucumberCoverImage };
  // Phase 2.35C：红参已软下架（isPublished=false），不引入红参专用封面图。

  // ── abalone / 鲍鱼 ─────────────────────────────
  if (productName.includes('鲍鱼')) return { title: '鲍鱼', subtitle: '鲜香浓郁', coverSrc: productAbalone12HeadCoverImage };

  // ── ginseng-class / 滋补参 / 草本 ─────────────
  if (productName.includes('西洋参')) return { title: '西洋参', subtitle: '日常食养', coverSrc: productAmericanGinsengCoverImage };
  if (productName.includes('党参')) return { title: '党参', subtitle: '日常滋补', coverSrc: productDangshenCoverImage };
  if (productName.includes('太子参')) return { title: '太子参', subtitle: '日常滋补', coverSrc: productTaizishenCoverImage };
  if (productName.includes('田七')) return { title: '田七', subtitle: '炖汤搭配', coverSrc: productTianqiCoverImage };
  if (productName.includes('石斛')) return { title: '石斛', subtitle: '草本食养', coverSrc: productDendrobiumCoverImage };
  if (productName.includes('陈皮')) return { title: '陈皮', subtitle: '陈香浓郁', coverSrc: productDriedTangerinePeelCoverImage };

  // ── mushrooms + 南北干货 ──────────────────────
  if (productName.includes('羊肚菌')) return { title: '羊肚菌', subtitle: '菌香浓郁', coverSrc: productMorelMushroomCoverImage };
  if (productName.includes('猴头菇')) return { title: '猴头菇', subtitle: '菌香醇厚', coverSrc: productHoutouguCoverImage };
  if (productName.includes('茶树菇')) return { title: '茶树菇', subtitle: '家常炖煮', coverSrc: productChashuguCoverImage };
  if (productName.includes('雪耳')) return { title: '雪耳', subtitle: '口感柔嫩', coverSrc: productSnowFungusCoverImage };
  if (productName.includes('百合')) return { title: '百合', subtitle: '日常炖煮', coverSrc: productBaiheCoverImage };
  if (productName.includes('莲子')) return { title: '莲子', subtitle: '日常滋补', coverSrc: productLianziCoverImage };
  if (productName.includes('红枣')) return { title: '红枣', subtitle: '搭配汤膳', coverSrc: productHongzaoCoverImage };

  // ── other seafood / 海产干货 ──────────────────
  if (productName.includes('章鱼')) return { title: '章鱼', subtitle: '煲汤搭配', coverSrc: productOctopusCoverImage };
  if (productName.includes('大土鱿')) return { title: '大土鱿', subtitle: '鲜香饱满', coverSrc: productDriedSquidCoverImage };
  if (productName.includes('墨鱼')) return { title: '墨鱼', subtitle: '家常炖煮', coverSrc: productCuttlefishCoverImage };
  if (productName.includes('靓虾米')) return { title: '靓虾米', subtitle: '鲜香饱满', coverSrc: productDriedShrimpCoverImage };
  if (productName.includes('响螺片')) return { title: '响螺片', subtitle: '滋补汤膳', coverSrc: productXiangluopianCoverImage };
  if (productName.includes('生晒蚝')) return { title: '生晒蚝', subtitle: '鲜香浓郁', coverSrc: productShengshaihaoCoverImage };

  return { title: '海味干货', subtitle: '绿膳荟精选', coverSrc: productSoupCoverImage };
}

// 干货封面统一解析：
// 1) DB 有合法 http(s) coverImageUrl → 优先使用正式远程图片；
// 2) 否则保持历史兼容：按商品名映射 bundled local artwork。
// 不解析 legacy assets/products/... 为运行时 URL，避免 Web/Miniapp 合同混淆。
export function getProductCover(productName: string, coverImageUrl?: string | null): string {
  const url = (coverImageUrl ?? '').trim();

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return getProductArtwork(productName).coverSrc;
}
