import driedGoodsIcon from '../assets/category-icons/dried_goods.png';
import fishFreshIcon from '../assets/category-icons/fish_fresh.png';
import giftPackIcon from '../assets/category-icons/gift_pack.png';
import recommendThumbIcon from '../assets/category-icons/recommend_thumb.png';
import seafoodPlatterIcon from '../assets/category-icons/seafood_platter.png';
import soupPotIcon from '../assets/category-icons/soup_pot.png';
import vipMemberIcon from '../assets/category-icons/vip_member.png';
// Phase 2.52E-3：干货分类导航新增 9 图（来源 图片/干货分类图标，按图内容映射，缩放 128×128 接入）。
import catSeaCucumberAbaloneIcon from '../assets/category-icons/cat_sea_cucumber_abalone.png';
import catScallopConpoyIcon from '../assets/category-icons/cat_scallop_conpoy.png';
import catGinsengTonicIcon from '../assets/category-icons/cat_ginseng_tonic.png';
import catMushroomIcon from '../assets/category-icons/cat_mushroom.png';
import catFlowerHerbalTeaIcon from '../assets/category-icons/cat_flower_herbal_tea.png';
import catDatesLotusIcon from '../assets/category-icons/cat_dates_lotus.png';
import catNutsGrainsIcon from '../assets/category-icons/cat_nuts_grains.png';
import catTangerineSpiceIcon from '../assets/category-icons/cat_tangerine_spice.png';
import catOthersGiftIcon from '../assets/category-icons/cat_others_gift.png';

const CATEGORY_ICON_MAP: Record<string, string> = {
  // 保留不变的 4 个既有图标
  全部: recommendThumbIcon,
  今日推荐: recommendThumbIcon,
  海味干货: driedGoodsIcon,
  花胶鱼胶: fishFreshIcon,
  // Phase 2.52E-3 新接入 9 个干货分类图标
  海参鲍肚: catSeaCucumberAbaloneIcon,
  元贝瑶柱: catScallopConpoyIcon,
  参茸滋补: catGinsengTonicIcon,
  菌菇干货: catMushroomIcon,
  花果茶草本: catFlowerHerbalTeaIcon,
  枣莲百合: catDatesLotusIcon,
  坚果杂粮: catNutsGrainsIcon,
  陈皮香料: catTangerineSpiceIcon,
  其他: catOthersGiftIcon,
  // 历史别名（其它页面/旧数据可能引用，保留以免回退）
  海味汤料: soupPotIcon,
  滋补汤料: soupPotIcon,
  干贝瑶柱: catScallopConpoyIcon,
  干货海味: driedGoodsIcon,
  海鲜严选: seafoodPlatterIcon,
  礼盒: giftPackIcon,
  礼盒套装: giftPackIcon,
  会员: vipMemberIcon,
  VIP: vipMemberIcon
};

export function getCategoryIcon(category: string): string | undefined {
  return CATEGORY_ICON_MAP[category];
}
