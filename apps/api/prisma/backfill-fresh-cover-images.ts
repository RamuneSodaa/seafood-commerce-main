/**
 * Phase 2.49L-b — 新鲜渔产单品图 coverImageUrl 回填（默认 DRY-RUN，安全）
 *
 * 仅更新 internalTag=fresh_seafood_catalog 且**人工确认唯一匹配**的 Product.coverImageUrl。
 * coverImageUrl 只写**稳定 key 文件名**（如 fresh_wild_octopus_cover.png），前台 getFreshProductCover 解析；
 * 绝不写 Mac 绝对路径或 鱼店图片/ 原始路径。不改其它字段、不改 dry 商品、不碰 SKU/库存/订单/支付。
 *
 * 用法：
 *   dry-run：node -r ts-node/register prisma/backfill-fresh-cover-images.ts
 *   apply  ：node -r ts-node/register prisma/backfill-fresh-cover-images.ts --apply --confirm-fresh-cover-image-backfill
 */
import { PrismaClient } from '@prisma/client';

const FRESH_TAG = 'fresh_seafood_catalog';
// 人工确认映射（商品名 → 稳定 key 文件名）。来源：用户 contact sheet #编号人工确认（#6 排除）。
const NAME_TO_KEY: Record<string, string> = {
  野生马友: 'fresh_wild_mayou_fish_cover.png',
  野生金昌鱼: 'fresh_wild_golden_pompano_cover.png',
  野生花斑虾: 'fresh_wild_flower_shrimp_cover.png',
  野生海狼: 'fresh_wild_hailang_fish_cover.png',
  野生章鱼: 'fresh_wild_octopus_cover.png',
  野生小蚝: 'fresh_wild_oyster_cover.png',
  野生黄尾: 'fresh_wild_yellowtail_cover.png',
  野生鱿鱼: 'fresh_wild_squid_cover.png',
  野生小九虾: 'fresh_wild_small_jiu_shrimp_cover.png',
  野生大明虾: 'fresh_wild_large_prawn_cover.png',
  野生金线鱼: 'fresh_wild_golden_threadfin_bream_cover.png',
  野生龙利鱼: 'fresh_wild_sole_fish_cover.png',
  // Phase 2.49L-d1：剩余 22 个（生成顺序映射，用户已确认目标 12→34、缺图 22→0）。
  野生大米仓: 'fresh_wild_damicang_fish_cover.png',
  野生花泥猛: 'fresh_wild_spotted_rabbitfish_cover.png',
  野生黄钻沙尖: 'fresh_wild_yellow_sand_whiting_cover.png',
  野生斗昌: 'fresh_wild_douchang_pomfret_cover.png',
  野生明丁公: 'fresh_wild_mingdinggong_fish_cover.png',
  野生红杉鱼: 'fresh_wild_crimson_snapper_cover.png',
  野生杂鱼: 'fresh_wild_mixed_fish_cover.png',
  野生松鱼: 'fresh_wild_songyu_fish_cover.png',
  野生泥鱼: 'fresh_wild_niyu_fish_cover.png',
  野生红友: 'fresh_wild_hongyou_snapper_cover.png',
  野生脐鱼: 'fresh_wild_qiyu_fish_cover.png',
  野生腊鱼: 'fresh_wild_layu_fish_cover.png',
  野生软唇: 'fresh_wild_sweetlips_cover.png',
  野生铁甲: 'fresh_wild_tiejia_jack_cover.png',
  野生青斑: 'fresh_wild_green_grouper_cover.png',
  野生青衣: 'fresh_wild_green_wrasse_cover.png',
  野生剥皮牛: 'fresh_wild_filefish_cover.png',
  野生石九公: 'fresh_wild_scorpionfish_cover.png',
  野生石头鱼: 'fresh_wild_stonefish_cover.png',
  野生金钱斑: 'fresh_wild_coral_trout_cover.png',
  野生长尾鲳: 'fresh_wild_longtail_pomfret_cover.png',
  野生鸡笼仓: 'fresh_wild_jilongcang_fish_cover.png'
};

const argv = process.argv.slice(2);
const has = (f: string) => argv.includes(f);
const mode: 'dry-run' | 'apply' = has('--apply') ? 'apply' : 'dry-run';

async function main() {
  if (mode === 'apply' && !has('--confirm-fresh-cover-image-backfill')) {
    throw new Error('apply 必须同时传 --apply 与 --confirm-fresh-cover-image-backfill。');
  }
  const prisma = new PrismaClient();
  try {
    const dbn = await prisma.$queryRawUnsafe<any[]>('SELECT current_database() AS db');
    if (dbn?.[0]?.db !== 'seafood_phase1_realdev') throw new Error(`仅允许写 seafood_phase1_realdev，当前=${dbn?.[0]?.db}`);

    const freshProducts = await prisma.product.findMany({
      where: { internalTag: FRESH_TAG },
      select: { id: true, name: true, coverImageUrl: true }
    });
    const byName = new Map<string, { id: string; coverImageUrl: string | null }[]>();
    for (const p of freshProducts) {
      const arr = byName.get(p.name) ?? [];
      arr.push({ id: p.id, coverImageUrl: p.coverImageUrl });
      byName.set(p.name, arr);
    }

    const plans: Array<{ name: string; id: string; key: string }> = [];
    let skippedNotFound = 0, skippedAmbiguous = 0;
    for (const [name, key] of Object.entries(NAME_TO_KEY)) {
      const matches = byName.get(name) ?? [];
      if (matches.length === 0) { skippedNotFound++; continue; }
      if (matches.length > 1) { skippedAmbiguous++; continue; }
      plans.push({ name, id: matches[0].id, key });
    }
    const skippedNoImage = freshProducts.length - Object.keys(NAME_TO_KEY).length; // 无人工映射的 fresh 商品（继续用占位图）

    const summary = {
      mode,
      currentDatabase: dbn?.[0]?.db,
      totalFreshProducts: freshProducts.length,
      plannedUpdates: plans.length,
      skippedNoImage,
      skippedAmbiguous,
      skippedNotFound,
      dbWrite: mode === 'apply' && plans.length > 0
    };
    console.log('backfill-fresh-cover-images:', JSON.stringify(summary, null, 2));
    for (const p of plans) console.log(`  ${mode === 'apply' ? 'UPDATE' : 'PLAN'}  ${p.name} -> coverImageUrl=${p.key}`);

    if (mode === 'dry-run') { console.log('当前为 dry-run，未写入数据库。'); return; }

    let updated = 0;
    for (const p of plans) {
      await prisma.product.update({ where: { id: p.id }, data: { coverImageUrl: p.key } });
      updated++;
    }
    console.log('backfill apply 完成：', { updated });
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error(String(e?.message || e)); process.exit(1); });
