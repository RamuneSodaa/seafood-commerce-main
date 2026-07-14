// 仅限本地开发，禁止生产运行。
import {
  AdminRole,
  CouponDiscountType,
  CouponScene,
  CouponTemplateStatus,
  MemberLevel,
  PrismaClient,
  type Product,
  type Sku,
  type Store
} from '@prisma/client';
import { hashAdminPassword } from '../src/modules/admin-auth/password-hash';

const prisma = new PrismaClient();

const PRIMARY_GUANGZHOU_STORE_CODE = 'STORE_GZ_TH_YUANCUN_MARKET';

const GUANGZHOU_STORES = [
  {
    code: 'STORE_GZ_LW_LONGJIN_352',
    name: '绿膳荟汤料店',
    address: '广州市荔湾区龙津中路352号',
    contactName: null,
    contactPhone: null
  },
  {
    code: 'STORE_GZ_YX_ZHONGSHAN6_99',
    name: '尚胶尚参',
    address: '广州市越秀区中山六路99号',
    contactName: null,
    contactPhone: null
  },
  {
    code: PRIMARY_GUANGZHOU_STORE_CODE,
    name: '绿膳荟干货海味店',
    address: '广州市天河区员村街道白水塘小区员村市场西二门对面',
    contactName: '温俊杰',
    contactPhone: '15920484176'
  },
  {
    code: 'STORE_GZ_YX_XIHUA_525',
    name: '绿膳荟海味干货店',
    address: '广州市越秀区西华路525号',
    contactName: '林金花',
    contactPhone: '13533753989'
  },
  {
    code: 'STORE_GZ_YX_XIAOBEI_161',
    name: '益康海味店',
    address: '广州市越秀区小北路161号',
    contactName: '温俊健',
    contactPhone: '13802931994'
  },
  {
    code: 'STORE_GZ_HZ_RUIBAO_LIHUA_8',
    name: '绿膳荟（海珠瑞宝店）',
    address: '广东省广州海珠区瑞宝街道丽华街8号',
    contactName: '陈生',
    contactPhone: '18054202606'
  }
];

// Phase 2.35C：商家决策——以下测试/待定商品软下架，不在小程序公开列表展示。
// 软下架方式：isPublished = false（保留 DB 商品记录与 SKU，不硬删，不删订单/购物车）。
// /products（listPublished）只返回 isPublished: true，因此这些商品不会再公开返回。
//   - 海味汤料组合 / 干贝瑶柱 / 精选花胶筒：测试阶段临时商品，非真实在售商品。
//   - 红参：商家决策先不进小程序（待确认到底是海参类还是人参类）。
const HIDDEN_PRODUCT_NAMES = new Set<string>([
  '海味汤料组合',
  '干贝瑶柱',
  '精选花胶筒',
  '红参',
  // Phase 2.36C：商家决策——鳕鱼胶先不上，软下架（isPublished=false），保留 DB 记录与 SKU，不硬删。
  '鳕鱼胶'
]);

const REAL_PRODUCTS = [
  {
    name: '精选花胶筒',
    category: '花胶鱼胶',
    sortOrder: 30,
    isRecommended: true,
    description: '肉厚胶质足，适合炖汤滋补，支持广州门店自提与邮寄发货。',
    skus: [
      { code: 'FISH_MAW_TUBE_250G', name: '250克', priceCents: 16800 },
      { code: 'FISH_MAW_TUBE_500G', name: '500克', priceCents: 31800 }
    ]
  },
  {
    name: '干贝瑶柱',
    category: '干贝瑶柱',
    sortOrder: 20,
    isRecommended: true,
    description: '鲜香浓郁，适合煲粥、炖汤、家常烹饪。',
    skus: [
      { code: 'DRIED_SCALLOP_250G', name: '250克', priceCents: 9800 },
      { code: 'DRIED_SCALLOP_500G', name: '500克', priceCents: 18800 }
    ]
  },
  {
    name: '海味汤料组合',
    category: '滋补汤料',
    sortOrder: 10,
    isRecommended: true,
    description: '家庭煲汤搭配，适合日常滋补汤膳。',
    skus: [
      { code: 'SEAFOOD_SOUP_PACK_STANDARD', name: '标准装', priceCents: 6800 },
      { code: 'SEAFOOD_SOUP_PACK_FAMILY', name: '家庭装', priceCents: 12800 }
    ]
  },
  // ↓ Phase 2.33C 新增：7 个样板商品（测试价，待商家确认）
  // 价格说明：单位为分（cents），priceCents = 元 × 100。
  // 例如 1680 元 = 168000 cents。
  {
    name: '黄花胶',
    category: '花胶鱼胶',
    sortOrder: 28,
    isRecommended: false,
    description: '色泽自然，适合炖汤滋补。',
    skus: [
      { code: 'YELLOW_FISH_MAW_250G', name: '250克', priceCents: 168000 },
      { code: 'YELLOW_FISH_MAW_500G', name: '500克', priceCents: 320000 }
    ]
  },
  {
    name: '鳘鱼胶王',
    category: '花胶鱼胶',
    sortOrder: 27,
    isRecommended: false,
    description: '肉厚胶质足，适合炖汤滋补。',
    skus: [
      { code: 'MIN_FISH_MAW_KING_250G', name: '250克', priceCents: 238000 },
      { code: 'MIN_FISH_MAW_KING_500G', name: '500克', priceCents: 460000 }
    ]
  },
  {
    name: '大连辽参',
    category: '海参',
    sortOrder: 25,
    isRecommended: false,
    description: '海味珍品，口感厚实。',
    skus: [
      { code: 'DALIAN_SEA_CUCUMBER_250G', name: '250克', priceCents: 118000 },
      { code: 'DALIAN_SEA_CUCUMBER_500G', name: '500克', priceCents: 228000 }
    ]
  },
  {
    name: '刺王参',
    category: '海参',
    sortOrder: 24,
    isRecommended: false,
    description: '参体饱满，适合家常滋补。',
    skus: [
      { code: 'THORN_KING_SEA_CUCUMBER_250G', name: '250克', priceCents: 78000 },
      { code: 'THORN_KING_SEA_CUCUMBER_500G', name: '500克', priceCents: 150000 }
    ]
  },
  {
    name: '12头鲍鱼',
    category: '鲍鱼',
    sortOrder: 22,
    isRecommended: false,
    description: '个头规整，鲜香浓郁。',
    skus: [
      { code: 'ABALONE_12HEAD_STANDARD', name: '标准装', priceCents: 49500 },
      { code: 'ABALONE_12HEAD_FAMILY', name: '家庭装', priceCents: 95000 }
    ]
  },
  {
    name: '西洋参',
    category: '滋补参类',
    sortOrder: 18,
    isRecommended: false,
    description: '片型均匀，适合日常食养。',
    skus: [
      { code: 'AMERICAN_GINSENG_100G', name: '100克', priceCents: 43500 },
      { code: 'AMERICAN_GINSENG_250G', name: '250克', priceCents: 98000 }
    ]
  },
  {
    name: '羊肚菌',
    category: '菌菇',
    sortOrder: 15,
    isRecommended: false,
    description: '菌香浓郁，适合炖汤煲汤。',
    skus: [
      { code: 'MOREL_MUSHROOM_100G', name: '100克', priceCents: 43500 },
      { code: 'MOREL_MUSHROOM_250G', name: '250克', priceCents: 98000 }
    ]
  },
  // ↓ Phase 2.34A 新增：30 个测试商品（测试价，待商家确认；priceCents = 元 × 100）
  // 排序策略：新增商品 sortOrder 35-64，全部排在现有 10 个商品（10-30）之后。
  // 花胶鱼胶类（6）
  {
    name: '靓黄花胶',
    category: '花胶鱼胶',
    sortOrder: 35,
    isRecommended: false,
    description: '色泽自然，胶质丰盈。',
    skus: [
      { code: 'LIANG_YELLOW_FISH_MAW_250G', name: '250克', priceCents: 188000 },
      { code: 'LIANG_YELLOW_FISH_MAW_500G', name: '500克', priceCents: 360000 }
    ]
  },
  {
    name: '厚肉鳘鱼胶',
    category: '花胶鱼胶',
    sortOrder: 36,
    isRecommended: false,
    description: '胶身厚实，适合炖汤搭配。',
    skus: [
      { code: 'THICK_MIN_FISH_MAW_250G', name: '250克', priceCents: 238000 },
      { code: 'THICK_MIN_FISH_MAW_500G', name: '500克', priceCents: 460000 }
    ]
  },
  {
    name: '鸡蛋胶',
    category: '花胶鱼胶',
    sortOrder: 37,
    isRecommended: false,
    description: '胶质细腻，适合家常炖煮。',
    skus: [
      { code: 'EGG_FISH_MAW_250G', name: '250克', priceCents: 33800 },
      { code: 'EGG_FISH_MAW_500G', name: '500克', priceCents: 65000 }
    ]
  },
  {
    name: '鳕鱼胶',
    category: '花胶鱼胶',
    sortOrder: 38,
    isRecommended: false,
    description: '适合日常炖汤搭配。',
    skus: [
      { code: 'COD_FISH_MAW_250G', name: '250克', priceCents: 29500 },
      { code: 'COD_FISH_MAW_500G', name: '500克', priceCents: 56000 }
    ]
  },
  {
    name: '鳝鱼胶',
    category: '花胶鱼胶',
    sortOrder: 39,
    isRecommended: false,
    description: '胶质浓郁，适合炖汤。',
    skus: [
      { code: 'EEL_FISH_MAW_250G', name: '250克', priceCents: 68000 },
      { code: 'EEL_FISH_MAW_500G', name: '500克', priceCents: 130000 }
    ]
  },
  {
    name: '斗湖胶',
    category: '花胶鱼胶',
    sortOrder: 40,
    isRecommended: false,
    description: '胶质丰盈，适合滋补汤膳。',
    skus: [
      { code: 'DOUHU_FISH_MAW_250G', name: '250克', priceCents: 78000 },
      { code: 'DOUHU_FISH_MAW_500G', name: '500克', priceCents: 150000 }
    ]
  },
  // 海参类（4）
  {
    name: '光秃参',
    category: '海参',
    sortOrder: 41,
    isRecommended: false,
    description: '参体光润，适合家常炖煮。',
    skus: [
      { code: 'BALD_SEA_CUCUMBER_250G', name: '250克', priceCents: 48000 },
      { code: 'BALD_SEA_CUCUMBER_500G', name: '500克', priceCents: 93000 }
    ]
  },
  {
    name: '靓辽参',
    category: '海参',
    sortOrder: 42,
    isRecommended: false,
    description: '海味珍品，口感厚实。',
    skus: [
      { code: 'LIANG_LIAOSHEN_250G', name: '250克', priceCents: 128000 },
      { code: 'LIANG_LIAOSHEN_500G', name: '500克', priceCents: 248000 }
    ]
  },
  {
    name: '红参',
    category: '海参',
    sortOrder: 43,
    isRecommended: false,
    description: '适合日常滋补汤膳。',
    skus: [
      { code: 'RED_SEA_CUCUMBER_250G', name: '250克', priceCents: 68000 },
      { code: 'RED_SEA_CUCUMBER_500G', name: '500克', priceCents: 130000 }
    ]
  },
  {
    name: '小刺参',
    category: '海参',
    sortOrder: 44,
    isRecommended: false,
    description: '参体小巧，适合家常炖煮。',
    skus: [
      { code: 'SMALL_THORN_SEA_CUCUMBER_250G', name: '250克', priceCents: 78000 },
      { code: 'SMALL_THORN_SEA_CUCUMBER_500G', name: '500克', priceCents: 150000 }
    ]
  },
  // 鲍鱼类（2）
  {
    name: '鲍鱼',
    category: '鲍鱼',
    sortOrder: 45,
    isRecommended: false,
    description: '鲜香浓郁，适合炖煲。',
    skus: [
      { code: 'ABALONE_STANDARD', name: '标准装', priceCents: 35500 },
      { code: 'ABALONE_FAMILY', name: '家庭装', priceCents: 68000 }
    ]
  },
  {
    name: '10头鲍鱼',
    category: '鲍鱼',
    sortOrder: 46,
    isRecommended: false,
    description: '个头规整，鲜香浓郁。',
    skus: [
      { code: 'ABALONE_10HEAD_STANDARD', name: '标准装', priceCents: 49500 },
      { code: 'ABALONE_10HEAD_FAMILY', name: '家庭装', priceCents: 95000 }
    ]
  },
  // 干贝瑶柱类（1）
  {
    name: '大元贝',
    category: '干贝瑶柱',
    sortOrder: 47,
    isRecommended: false,
    description: '鲜甜浓郁，适合家常烹饪。',
    skus: [
      { code: 'DRIED_BIG_SCALLOP_250G', name: '250克', priceCents: 23800 },
      { code: 'DRIED_BIG_SCALLOP_500G', name: '500克', priceCents: 46000 }
    ]
  },
  // 海产干货类（6）
  {
    name: '章鱼',
    category: '海产干货',
    sortOrder: 48,
    isRecommended: false,
    description: '口感醇厚，适合煲汤。',
    skus: [
      { code: 'OCTOPUS_250G', name: '250克', priceCents: 15800 },
      { code: 'OCTOPUS_500G', name: '500克', priceCents: 30000 }
    ]
  },
  {
    name: '大土鱿',
    category: '海产干货',
    sortOrder: 49,
    isRecommended: false,
    description: '鲜香饱满，适合家常烹饪。',
    skus: [
      { code: 'DA_TU_SQUID_250G', name: '250克', priceCents: 16800 },
      { code: 'DA_TU_SQUID_500G', name: '500克', priceCents: 32000 }
    ]
  },
  {
    name: '墨鱼',
    category: '海产干货',
    sortOrder: 50,
    isRecommended: false,
    description: '适合家常炖煮汤膳。',
    skus: [
      { code: 'CUTTLEFISH_250G', name: '250克', priceCents: 12800 },
      { code: 'CUTTLEFISH_500G', name: '500克', priceCents: 25000 }
    ]
  },
  {
    name: '靓虾米',
    category: '海产干货',
    sortOrder: 51,
    isRecommended: false,
    description: '鲜香饱满，适合家常烹饪。',
    skus: [
      { code: 'LIANG_DRIED_SHRIMP_250G', name: '250克', priceCents: 11800 },
      { code: 'LIANG_DRIED_SHRIMP_500G', name: '500克', priceCents: 22000 }
    ]
  },
  {
    name: '响螺片',
    category: '海产干货',
    sortOrder: 52,
    isRecommended: false,
    description: '片型均匀，适合滋补汤膳。',
    skus: [
      { code: 'XIANGLUO_SLICE_250G', name: '250克', priceCents: 19800 },
      { code: 'XIANGLUO_SLICE_500G', name: '500克', priceCents: 38000 }
    ]
  },
  {
    name: '生晒蚝',
    category: '海产干货',
    sortOrder: 53,
    isRecommended: false,
    description: '鲜香浓郁，适合家常炖煮。',
    skus: [
      { code: 'SUN_DRIED_OYSTER_250G', name: '250克', priceCents: 18800 },
      { code: 'SUN_DRIED_OYSTER_500G', name: '500克', priceCents: 36000 }
    ]
  },
  // 滋补参类（3）
  {
    name: '党参',
    category: '滋补参类',
    sortOrder: 54,
    isRecommended: false,
    description: '适合日常滋补汤膳。',
    skus: [
      { code: 'DANGSHEN_250G', name: '250克', priceCents: 20800 },
      { code: 'DANGSHEN_500G', name: '500克', priceCents: 40000 }
    ]
  },
  {
    name: '太子参',
    category: '滋补参类',
    sortOrder: 55,
    isRecommended: false,
    description: '适合家常炖煮汤膳。',
    skus: [
      { code: 'TAIZISHEN_250G', name: '250克', priceCents: 23800 },
      { code: 'TAIZISHEN_500G', name: '500克', priceCents: 46000 }
    ]
  },
  {
    name: '田七',
    category: '滋补参类',
    sortOrder: 56,
    isRecommended: false,
    description: '适合日常炖汤搭配。',
    skus: [
      { code: 'TIANQI_250G', name: '250克', priceCents: 23000 },
      { code: 'TIANQI_500G', name: '500克', priceCents: 44000 }
    ]
  },
  // 草本食养（2）
  {
    name: '石斛条',
    category: '草本食养',
    sortOrder: 57,
    isRecommended: false,
    description: '适合家常炖煮汤膳。',
    skus: [
      { code: 'SHIHU_BAR_250G', name: '250克', priceCents: 38000 },
      { code: 'SHIHU_BAR_500G', name: '500克', priceCents: 73000 }
    ]
  },
  {
    name: '陈皮',
    category: '草本食养',
    sortOrder: 58,
    isRecommended: false,
    description: '陈香浓郁，适合家常烹饪。',
    skus: [
      { code: 'CHENPI_250G', name: '250克', priceCents: 23000 },
      { code: 'CHENPI_500G', name: '500克', priceCents: 44000 }
    ]
  },
  // 菌菇（3）
  {
    name: '猴头菇',
    category: '菌菇',
    sortOrder: 59,
    isRecommended: false,
    description: '菌香醇厚，适合炖煲。',
    skus: [
      { code: 'HOUTOUGU_250G', name: '250克', priceCents: 8800 },
      { code: 'HOUTOUGU_500G', name: '500克', priceCents: 16800 }
    ]
  },
  {
    name: '茶树菇',
    category: '菌菇',
    sortOrder: 60,
    isRecommended: false,
    description: '适合家常炖煮汤膳。',
    skus: [
      { code: 'CHASHUGU_250G', name: '250克', priceCents: 4800 },
      { code: 'CHASHUGU_500G', name: '500克', priceCents: 9000 }
    ]
  },
  {
    name: '雪耳',
    category: '菌菇',
    sortOrder: 61,
    isRecommended: false,
    description: '口感柔嫩，适合家常烹饪。',
    skus: [
      { code: 'SNOW_FUNGUS_250G', name: '250克', priceCents: 5800 },
      { code: 'SNOW_FUNGUS_500G', name: '500克', priceCents: 11000 }
    ]
  },
  // 南北干货（3）
  {
    name: '百合',
    category: '南北干货',
    sortOrder: 62,
    isRecommended: false,
    description: '适合日常炖煮搭配。',
    skus: [
      { code: 'DRIED_LILY_250G', name: '250克', priceCents: 6800 },
      { code: 'DRIED_LILY_500G', name: '500克', priceCents: 13000 }
    ]
  },
  {
    name: '莲子',
    category: '南北干货',
    sortOrder: 63,
    isRecommended: false,
    description: '适合日常滋补汤膳。',
    skus: [
      { code: 'LOTUS_SEED_250G', name: '250克', priceCents: 6800 },
      { code: 'LOTUS_SEED_500G', name: '500克', priceCents: 13000 }
    ]
  },
  {
    name: '红枣',
    category: '南北干货',
    sortOrder: 64,
    isRecommended: false,
    description: '颗粒饱满，适合搭配滋补汤膳。',
    skus: [
      { code: 'RED_DATE_250G', name: '250克', priceCents: 1800 },
      { code: 'RED_DATE_500G', name: '500克', priceCents: 3500 }
    ]
  }
];

const COUPON_TEMPLATES = [
  {
    code: 'NEW_USER_1000',
    name: '新人满减券',
    description: '新顾客可领取，确认订单时选择使用。',
    scene: CouponScene.NEW_USER,
    thresholdAmountCents: 6800,
    discountAmountCents: 1000,
    stackGroup: 'NEW_USER',
    canStack: true,
    priority: 90,
    autoGrantOnNewUser: true
  },
  {
    code: 'NEW_USER_500',
    name: '新客立减券',
    description: '新顾客自动发放，可与新人满减券叠加。',
    scene: CouponScene.NEW_USER,
    thresholdAmountCents: 0,
    discountAmountCents: 500,
    stackGroup: 'NEW_USER',
    canStack: true,
    priority: 80,
    autoGrantOnNewUser: true
  },
  {
    code: 'REFERRAL_INVITER_1500',
    name: '邀请奖励券',
    description: '好友首单完成后发放给邀请人。',
    scene: CouponScene.REFERRAL_INVITER,
    thresholdAmountCents: 9800,
    discountAmountCents: 1500,
    stackGroup: 'REFERRAL',
    canStack: false,
    priority: 70,
    autoGrantOnNewUser: false
  },
  {
    code: 'REFERRAL_INVITEE_1000',
    name: '好友首单券',
    description: '通过好友邀请进入后可用于首单。',
    scene: CouponScene.REFERRAL_INVITEE,
    thresholdAmountCents: 6800,
    discountAmountCents: 1000,
    stackGroup: 'REFERRAL',
    canStack: false,
    priority: 75,
    autoGrantOnNewUser: false
  }
];

function getDefaultMemberPriceCents(priceCents: number) {
  return Math.max(1, Math.floor(priceCents * 0.95 / 100) * 100);
}

async function unpublishLegacyDemoProducts() {
  const demoProducts = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: '新鲜三文鱼' } },
        { description: { contains: '一期演示商品' } }
      ]
    },
    select: { id: true, name: true }
  });

  const demoProductIds = demoProducts.map((product) => product.id);

  if (demoProductIds.length === 0) {
    return { demoProducts, disabledDemoSkuCount: 0 };
  }

  await prisma.product.updateMany({
    where: { id: { in: demoProductIds } },
    data: { isPublished: false }
  });

  const demoSkus = await prisma.sku.findMany({
    where: { productId: { in: demoProductIds } },
    select: { id: true }
  });

  const demoSkuIds = demoSkus.map((sku) => sku.id);

  if (demoSkuIds.length === 0) {
    return { demoProducts, disabledDemoSkuCount: 0 };
  }

  const disabledDemoAvailability = await prisma.storeSkuAvailability.updateMany({
    where: { skuId: { in: demoSkuIds } },
    data: { isEnabled: false }
  });

  return { demoProducts, disabledDemoSkuCount: disabledDemoAvailability.count };
}

async function upsertRealProduct(productData: (typeof REAL_PRODUCTS)[number]) {
  const existingProduct = await prisma.product.findFirst({
    where: { name: productData.name }
  });

  const product = existingProduct
    ? await prisma.product.update({
        where: { id: existingProduct.id },
        data: {
          description: productData.description,
          category: productData.category,
          sortOrder: productData.sortOrder,
          isRecommended: productData.isRecommended,
          coverImageUrl: null,
          isPublished: !HIDDEN_PRODUCT_NAMES.has(productData.name),
          supportsPickup: true,
          supportsShipping: true
        }
      })
    : await prisma.product.create({
        data: {
          name: productData.name,
          description: productData.description,
          category: productData.category,
          sortOrder: productData.sortOrder,
          isRecommended: productData.isRecommended,
          coverImageUrl: null,
          isPublished: !HIDDEN_PRODUCT_NAMES.has(productData.name),
          supportsPickup: true,
          supportsShipping: true
        }
      });

  const skus: Sku[] = [];

  for (const skuData of productData.skus) {
    const sku = await prisma.sku.upsert({
      where: { code: skuData.code },
      update: {
        name: skuData.name,
        priceCents: skuData.priceCents
      },
      create: {
        productId: product.id,
        code: skuData.code,
        name: skuData.name,
        priceCents: skuData.priceCents
      }
    });

    if (sku.productId !== product.id) {
      throw new Error(`稳定规格编码 ${skuData.code} 已绑定到其他商品，请人工检查 seed 数据。`);
    }

    skus.push(sku);
  }

  return { product, skus };
}

async function ensureCouponTemplates() {
  for (const template of COUPON_TEMPLATES) {
    await prisma.couponTemplate.upsert({
      where: { code: template.code },
      update: {
        name: template.name,
        description: template.description,
        discountType: CouponDiscountType.AMOUNT_OFF,
        thresholdAmountCents: template.thresholdAmountCents,
        discountAmountCents: template.discountAmountCents,
        discountPercent: null,
        maxDiscountAmountCents: null,
        perUserLimit: 1,
        stackGroup: template.stackGroup,
        canStack: template.canStack,
        priority: template.priority,
        autoGrantOnNewUser: template.autoGrantOnNewUser,
        status: CouponTemplateStatus.ACTIVE,
        scene: template.scene
      },
      create: {
        code: template.code,
        name: template.name,
        description: template.description,
        discountType: CouponDiscountType.AMOUNT_OFF,
        thresholdAmountCents: template.thresholdAmountCents,
        discountAmountCents: template.discountAmountCents,
        perUserLimit: 1,
        stackGroup: template.stackGroup,
        canStack: template.canStack,
        priority: template.priority,
        autoGrantOnNewUser: template.autoGrantOnNewUser,
        status: CouponTemplateStatus.ACTIVE,
        scene: template.scene
      }
    });
  }
}

async function ensureDefaultMemberPrices(skus: Sku[]) {
  for (const sku of skus) {
    await prisma.skuMemberPrice.upsert({
      where: {
        skuId_memberLevel: {
          skuId: sku.id,
          memberLevel: MemberLevel.DEFAULT
        }
      },
      update: {
        priceCents: getDefaultMemberPriceCents(sku.priceCents),
        isActive: true
      },
      create: {
        skuId: sku.id,
        memberLevel: MemberLevel.DEFAULT,
        priceCents: getDefaultMemberPriceCents(sku.priceCents),
        isActive: true
      }
    });
  }
}

async function main() {
  // Phase 2.41B：生产保护——本地 seed（含 dev 弱口令管理员）禁止在生产运行。生产管理员必须走 seed.production.admin.bootstrap.ts。
  if ((process.env.NODE_ENV || '').trim().toLowerCase() === 'production') {
    throw new Error('seed.local.ts 仅限本地开发，禁止在 NODE_ENV=production 运行。生产管理员请使用 seed.production.admin.bootstrap.ts。');
  }

  const legacyShanghaiStore = await prisma.store.upsert({
    where: { code: 'STORE_SH_001' },
    update: {
      name: '上海主门店',
      address: '海鲜路 1 号',
      contactName: '门店负责人',
      contactPhone: '13800000000',
      isActive: false
    },
    create: {
      code: 'STORE_SH_001',
      name: '上海主门店',
      address: '海鲜路 1 号',
      contactName: '门店负责人',
      contactPhone: '13800000000',
      isActive: false
    }
  });

  await prisma.storeSkuAvailability.updateMany({
    where: { storeId: legacyShanghaiStore.id },
    data: { isEnabled: false }
  });

  const stores: Store[] = [];

  for (const storeData of GUANGZHOU_STORES) {
    const store = await prisma.store.upsert({
      where: { code: storeData.code },
      update: {
        name: storeData.name,
        address: storeData.address,
        contactName: storeData.contactName,
        contactPhone: storeData.contactPhone,
        isActive: true
      },
      create: {
        code: storeData.code,
        name: storeData.name,
        address: storeData.address,
        contactName: storeData.contactName,
        contactPhone: storeData.contactPhone,
        isActive: true
      }
    });

    stores.push(store);
  }

  const primaryStore = stores.find((store) => store.code === PRIMARY_GUANGZHOU_STORE_CODE);

  if (!primaryStore) {
    throw new Error(`Primary Guangzhou store ${PRIMARY_GUANGZHOU_STORE_CODE} was not seeded`);
  }

  const legacyDemoResult = await unpublishLegacyDemoProducts();
  const seededProducts: Product[] = [];
  const seededSkus: Sku[] = [];

  for (const productData of REAL_PRODUCTS) {
    const seededProduct = await upsertRealProduct(productData);
    seededProducts.push(seededProduct.product);
    seededSkus.push(...seededProduct.skus);
  }

  await ensureCouponTemplates();
  await ensureDefaultMemberPrices(seededSkus);

  for (const store of stores) {
    for (const sku of seededSkus) {
      await prisma.storeSkuAvailability.upsert({
        where: { storeId_skuId: { storeId: store.id, skuId: sku.id } },
        update: { isEnabled: true },
        create: { storeId: store.id, skuId: sku.id, isEnabled: true }
      });

      await prisma.inventory.upsert({
        where: { storeId_skuId: { storeId: store.id, skuId: sku.id } },
        update: {
          physicalStock: 100,
          availableStock: 100,
          safeStock: 10
        },
        create: {
          storeId: store.id,
          skuId: sku.id,
          physicalStock: 100,
          availableStock: 100,
          reservedStock: 0,
          damagedStock: 0,
          safeStock: 10
        }
      });
    }
  }

  const devAdminUsername = process.env.ADMIN_DEV_USERNAME?.trim();
  const devAdminPassword = process.env.ADMIN_DEV_PASSWORD?.trim();
  let devAdminSeeded = false;

  if (devAdminUsername && devAdminPassword) {
    if (devAdminPassword.length < 8) {
      throw new Error('ADMIN_DEV_PASSWORD must be at least 8 characters');
    }

    await prisma.adminUser.upsert({
      where: { username: devAdminUsername },
      update: {
        passwordHash: hashAdminPassword(devAdminPassword),
        displayName: process.env.ADMIN_DEV_DISPLAY_NAME?.trim() || '本地管理员',
        role: AdminRole.ADMIN,
        storeId: null,
        isActive: true
      },
      create: {
        username: devAdminUsername,
        passwordHash: hashAdminPassword(devAdminPassword),
        displayName: process.env.ADMIN_DEV_DISPLAY_NAME?.trim() || '本地管理员',
        role: AdminRole.ADMIN,
        storeId: null,
        isActive: true
      }
    });
    devAdminSeeded = true;
    console.log(`Dev admin user ensured: ${devAdminUsername}`);
  }

  console.log('Seed completed', {
    primaryStoreId: primaryStore.id,
    activeGuangzhouStoreCount: stores.length,
    legacyShanghaiStoreId: legacyShanghaiStore.id,
    legacyShanghaiStoreActive: false,
    realProductCount: seededProducts.length,
    realSkuCount: seededSkus.length,
    realProductNames: seededProducts.map((product) => product.name),
    couponTemplateCodes: COUPON_TEMPLATES.map((template) => template.code),
    memberPriceSkuCount: seededSkus.length,
    unpublishedDemoProductCount: legacyDemoResult.demoProducts.length,
    disabledDemoAvailabilityCount: legacyDemoResult.disabledDemoSkuCount,
    createdDemoOrders: 0,
    devAdminSeeded
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
