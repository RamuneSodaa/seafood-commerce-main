import { AdminRole } from '@prisma/client';
import { hashAdminPassword } from '../src/modules/admin-auth/password-hash';
import {
  runSeedScript,
  assertNoLocalAdminDefaults,
  assertProductionApplyAllowed,
  printDryRunNotice,
  requirePrisma
} from './seed.shared';

runSeedScript('production admin bootstrap seed', async (prisma, options) => {
  assertProductionApplyAllowed(options, '--confirm-production-admin-bootstrap');

  const username = process.env.PRODUCTION_ADMIN_USERNAME?.trim();
  const password = process.env.PRODUCTION_ADMIN_PASSWORD?.trim();
  const displayName = process.env.PRODUCTION_ADMIN_DISPLAY_NAME?.trim();
  const authSecret = process.env.ADMIN_AUTH_SECRET?.trim();

  assertNoLocalAdminDefaults(username, password, authSecret);

  console.log('生产管理员 bootstrap 检查：', {
    hasUsername: Boolean(username),
    hasPassword: Boolean(password),
    hasDisplayName: Boolean(displayName),
    hasAdminAuthSecret: Boolean(authSecret)
  });

  if (options.mode === 'dry-run') {
    printDryRunNotice();
    console.log('不会输出密码、hash、token 或 secret。');
    return;
  }

  if (!username || !password || !displayName) {
    throw new Error('生产管理员 bootstrap 需要 PRODUCTION_ADMIN_USERNAME / PRODUCTION_ADMIN_PASSWORD / PRODUCTION_ADMIN_DISPLAY_NAME。');
  }

  if (password.length < 12) {
    throw new Error('生产管理员密码长度至少 12 位。');
  }

  const db = requirePrisma(prisma);

  await db.adminUser.upsert({
    where: { username },
    update: {
      passwordHash: hashAdminPassword(password),
      displayName,
      role: AdminRole.ADMIN,
      storeId: null,
      isActive: true
    },
    create: {
      username,
      passwordHash: hashAdminPassword(password),
      displayName,
      role: AdminRole.ADMIN,
      storeId: null,
      isActive: true
    }
  });

  console.log('生产管理员 bootstrap 完成：', { username, displayName });
});
