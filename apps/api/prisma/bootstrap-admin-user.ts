/**
 * Phase 2.49B — 管理员账号 bootstrap（默认 DRY-RUN，安全）
 *
 * 仅在 AdminUser=0 时创建 1 个 ADMIN；从环境变量读取，绝不打印明文密码/hash/secret。
 * 环境变量：
 *   ADMIN_BOOTSTRAP_USERNAME / ADMIN_BOOTSTRAP_PASSWORD / ADMIN_BOOTSTRAP_DISPLAY_NAME / ADMIN_AUTH_SECRET
 * 密码规则（与项目登录一致）：长度 >= 12 且含字母+数字。
 * 密码哈希：项目 helper hashAdminPassword（pbkdf2_sha256）。
 *
 * 用法：
 *   dry-run：node -r ts-node/register prisma/bootstrap-admin-user.ts
 *   apply  ：node -r ts-node/register prisma/bootstrap-admin-user.ts --apply --confirm-admin-bootstrap
 * （apply 前请在同一命令内联导出 4 个环境变量；勿写入仓库、勿明文入聊天。）
 */
import { PrismaClient, AdminRole } from '@prisma/client';
import { hashAdminPassword, validateNewAdminPassword } from '../src/modules/admin-auth/password-hash';

const argv = process.argv.slice(2);
const has = (f: string) => argv.includes(f);
const mode: 'dry-run' | 'apply' = has('--apply') ? 'apply' : 'dry-run';
const maskName = (s: string) => (s.length <= 2 ? '*'.repeat(s.length) : `${s[0]}***${s[s.length - 1]}(len=${s.length})`);

async function main() {
  if (mode === 'apply' && !has('--confirm-admin-bootstrap')) {
    throw new Error('apply 必须同时传 --apply 与 --confirm-admin-bootstrap。');
  }
  const username = (process.env.ADMIN_BOOTSTRAP_USERNAME || '').trim();
  const password = (process.env.ADMIN_BOOTSTRAP_PASSWORD || '').trim();
  const displayName = (process.env.ADMIN_BOOTSTRAP_DISPLAY_NAME || '').trim();
  const secret = (process.env.ADMIN_AUTH_SECRET || '').trim();

  const missing: string[] = [];
  if (!username) missing.push('ADMIN_BOOTSTRAP_USERNAME');
  if (!password) missing.push('ADMIN_BOOTSTRAP_PASSWORD');
  if (!displayName) missing.push('ADMIN_BOOTSTRAP_DISPLAY_NAME');
  if (!secret) missing.push('ADMIN_AUTH_SECRET');
  if (missing.length) throw new Error(`缺少环境变量：${missing.join(', ')}（不生成默认值，不写库）`);

  const pwdErr = validateNewAdminPassword(password); // 长度>=12 且含字母+数字
  if (pwdErr) throw new Error(`管理员密码不合规：${pwdErr}`);
  if (secret.length < 16) throw new Error('ADMIN_AUTH_SECRET 长度不足（建议 >= 16）。');

  const prisma = new PrismaClient();
  try {
    const dbn = await prisma.$queryRawUnsafe<any[]>('SELECT current_database() AS db');
    const dbName = dbn?.[0]?.db;
    if (dbName !== 'seafood_phase1_realdev') throw new Error(`仅允许写 seafood_phase1_realdev，当前=${dbName}`);

    const before = await prisma.adminUser.count();
    const summary = {
      mode, currentDatabase: dbName,
      adminUserBefore: before,
      willCreateAdminUser: before === 0,
      username_masked: maskName(username),
      displayName,
      role: 'ADMIN',
      passwordLengthOk: password.length >= 12,
      secretPresent: secret.length > 0,
      dbWrite: mode === 'apply' && before === 0,
    };
    console.log('admin bootstrap:', JSON.stringify(summary, null, 2));

    if (before !== 0) {
      console.log('AdminUser 已存在（count>0），不创建重复管理员，停止。');
      return;
    }
    if (mode === 'dry-run') { console.log('当前为 dry-run，未写入数据库。'); return; }

    const created = await prisma.adminUser.create({
      data: {
        username,
        passwordHash: hashAdminPassword(password), // 不打印
        displayName,
        role: AdminRole.ADMIN,
        storeId: null,
        isActive: true,
      },
      select: { id: true, username: true, role: true },
    });
    console.log('admin bootstrap 完成：', { createdAdminId: created.id, role: created.role, username_masked: maskName(created.username) });
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error(String(e?.message || e)); process.exit(1); });
