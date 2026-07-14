import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

const HASH_ALGORITHM = 'pbkdf2_sha256';
const DEFAULT_ITERATIONS = 120_000;
const KEY_LENGTH = 32;

export function hashAdminPassword(password: string, salt = randomBytes(16).toString('base64url')): string {
  const hash = pbkdf2Sync(password, salt, DEFAULT_ITERATIONS, KEY_LENGTH, 'sha256').toString('base64url');
  return `${HASH_ALGORITHM}$${DEFAULT_ITERATIONS}$${salt}$${hash}`;
}

// Phase 2.41B：管理员新密码强度校验。返回 null 表示通过，否则返回中文错误原因（不含密码内容）。
export function validateNewAdminPassword(newPassword: string): string | null {
  const value = (newPassword ?? '').trim();
  if (!value) return '新密码不能为空';
  if (value.length < 12) return '新密码长度至少 12 位';
  if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) return '新密码必须同时包含字母和数字';
  return null;
}

export function verifyAdminPassword(password: string, storedHash: string): boolean {
  const [algorithm, iterationsRaw, salt, hash] = storedHash.split('$');
  const iterations = Number(iterationsRaw);

  if (algorithm !== HASH_ALGORITHM || !Number.isFinite(iterations) || !salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, 'base64url');
  const actual = pbkdf2Sync(password, salt, iterations, expected.length, 'sha256');

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}
