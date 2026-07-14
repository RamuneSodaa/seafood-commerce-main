import { PrismaClient } from '@prisma/client';

export type SeedMode = 'dry-run' | 'apply';

export interface SeedRuntimeOptions {
  mode: SeedMode;
  args: Set<string>;
}

export function parseSeedRuntimeOptions(argv = process.argv.slice(2)): SeedRuntimeOptions {
  const args = new Set(argv);
  const mode: SeedMode = args.has('--apply') ? 'apply' : 'dry-run';
  return { mode, args };
}

export function assertProductionApplyAllowed(options: SeedRuntimeOptions, confirmFlag = '--confirm-production-seed') {
  if (options.mode !== 'apply') {
    return;
  }

  if (!options.args.has(confirmFlag)) {
    throw new Error(`生产 seed apply 需要显式传入 ${confirmFlag}，默认只允许 dry-run。`);
  }
}

export function assertNoLocalAdminDefaults(username?: string, password?: string, authSecret?: string) {
  if ((username || '').trim() === 'admin') {
    throw new Error('生产管理员 bootstrap 禁止使用本地默认用户名 admin。');
  }

  if ((password || '').trim() === 'Admin123456') {
    throw new Error('生产管理员 bootstrap 禁止使用本地默认密码 Admin123456。');
  }

  if ((authSecret || '').includes('local-admin-auth-secret')) {
    throw new Error('生产管理员 bootstrap 禁止使用本地 ADMIN_AUTH_SECRET。');
  }
}

export function printSeedHeader(name: string, options: SeedRuntimeOptions) {
  console.log(`${name}: ${options.mode === 'apply' ? 'APPLY' : 'DRY-RUN'}`);
}

export function printDryRunNotice() {
  console.log('当前为 dry-run，不写入数据库。');
}

export async function runSeedScript(name: string, fn: (prisma: PrismaClient | null, options: SeedRuntimeOptions) => Promise<void>) {
  const options = parseSeedRuntimeOptions();
  printSeedHeader(name, options);

  const prisma = options.mode === 'apply' ? new PrismaClient() : null;

  try {
    await fn(prisma, options);
  } finally {
    await prisma?.$disconnect();
  }
}

export function requirePrisma(prisma: PrismaClient | null): PrismaClient {
  if (!prisma) {
    throw new Error('当前为 dry-run，没有数据库连接。');
  }
  return prisma;
}

export function summarizeRecords<T extends { code?: string; name?: string }>(records: readonly T[]) {
  return records.map((record) => ({ code: record.code, name: record.name }));
}

export const PRODUCTION_STORE_CANDIDATES = [
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
    code: 'STORE_GZ_TH_YUANCUN_MARKET',
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
] as const;

export const PRODUCTION_PRODUCT_CANDIDATES = [
  {
    name: '精选花胶筒',
    category: '花胶鱼胶',
    sortOrder: 30,
    isRecommended: true,
    description: '肉厚胶质足，适合炖汤滋补，支持广州门店自提与邮寄发货。',
    requiresOperationalConfirmation: true,
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
    requiresOperationalConfirmation: true,
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
    requiresOperationalConfirmation: true,
    skus: [
      { code: 'SEAFOOD_SOUP_PACK_STANDARD', name: '标准装', priceCents: 6800 },
      { code: 'SEAFOOD_SOUP_PACK_FAMILY', name: '家庭装', priceCents: 12800 }
    ]
  }
] as const;

export const PRODUCTION_MARKETING_CANDIDATES = [
  {
    code: 'NEW_USER_1000',
    name: '新人满减券',
    description: '新顾客可领取，确认订单时选择使用。',
    thresholdAmountCents: 6800,
    discountAmountCents: 1000,
    stackGroup: 'NEW_USER',
    canStack: true,
    perUserLimit: 1,
    priority: 90,
    autoGrantOnNewUser: true,
    pendingOperationsApproval: true
  },
  {
    code: 'NEW_USER_500',
    name: '新客立减券',
    description: '新顾客自动发放，可与新人满减券叠加。',
    thresholdAmountCents: 0,
    discountAmountCents: 500,
    stackGroup: 'NEW_USER',
    canStack: true,
    perUserLimit: 1,
    priority: 80,
    autoGrantOnNewUser: true,
    pendingOperationsApproval: true
  },
  {
    code: 'REFERRAL_INVITER_1500',
    name: '邀请奖励券',
    description: '好友首单完成后发放给邀请人。',
    thresholdAmountCents: 9800,
    discountAmountCents: 1500,
    stackGroup: 'REFERRAL',
    canStack: false,
    perUserLimit: 1,
    priority: 70,
    autoGrantOnNewUser: false,
    pendingOperationsApproval: true
  },
  {
    code: 'REFERRAL_INVITEE_1000',
    name: '好友首单券',
    description: '通过好友邀请进入后可用于首单。',
    thresholdAmountCents: 6800,
    discountAmountCents: 1000,
    stackGroup: 'REFERRAL',
    canStack: false,
    perUserLimit: 1,
    priority: 75,
    autoGrantOnNewUser: false,
    pendingOperationsApproval: true
  }
] as const;

const PRIMARY_PRODUCTION_STORE_CODE = 'STORE_GZ_TH_YUANCUN_MARKET';

export const PRODUCTION_INVENTORY_CANDIDATES = PRODUCTION_PRODUCT_CANDIDATES.flatMap((product) =>
  product.skus.map((sku) => ({
    storeCode: PRIMARY_PRODUCTION_STORE_CODE,
    skuCode: sku.code,
    physicalStock: 20,
    safetyStock: 5,
    reservedStock: 0,
    requiresOperationalConfirmation: true
  }))
);
