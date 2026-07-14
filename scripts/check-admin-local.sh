#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.local/env/wechat-miniapp.local"
ADMIN_ENV_FILE="$PROJECT_ROOT/.local/env/admin.local"
API_URL="http://127.0.0.1:3000"
ADMIN_WEB_URL="http://127.0.0.1:3001"
ADMIN_LOGIN_URL="$ADMIN_WEB_URL/login"

cd "$PROJECT_ROOT"

if [ -f "$ENV_FILE" ]; then
  # shellcheck source=/dev/null
  source "$ENV_FILE"
else
  echo "本地环境变量文件不存在：$ENV_FILE"
fi

if [ ! -f "$ADMIN_ENV_FILE" ]; then
  bash "$SCRIPT_DIR/ensure-admin-local-env.sh"
fi

# shellcheck source=/dev/null
source "$ADMIN_ENV_FILE"

check_port() {
  local port="$1"
  local label="$2"
  if lsof -iTCP:"$port" -sTCP:LISTEN -n -P >/dev/null 2>&1; then
    echo "${label}：运行中"
  else
    echo "${label}：未运行"
  fi
}

check_http() {
  local url="$1"
  local label="$2"
  local status
  status="$(curl -sS -o /tmp/admin-local-check.out -w "%{http_code}" "$url" 2>/dev/null || true)"
  if [ "$status" -ge 200 ] 2>/dev/null && [ "$status" -lt 500 ] 2>/dev/null; then
    echo "${label}：正常（HTTP ${status}）"
  else
    echo "${label}：异常（${status:-无响应}）"
  fi
}

admin_login_payload() {
  node -e 'process.stdout.write(JSON.stringify({
    username: process.env.ADMIN_DEV_USERNAME,
    password: process.env.ADMIN_DEV_PASSWORD
  }))'
}

check_admin_login() {
  local status
  status="$(curl -sS -o /tmp/admin-local-login-check.out -w "%{http_code}" \
    -X POST "$API_URL/admin/auth/login" \
    -H 'Content-Type: application/json' \
    -d "$(admin_login_payload)" 2>/dev/null || true)"

  if [ "$status" -ge 200 ] 2>/dev/null && [ "$status" -lt 300 ] 2>/dev/null; then
    echo "后台登录接口：正常（HTTP ${status}）"
  else
    echo "后台登录接口：异常（${status:-无响应}）"
  fi
}

check_admin_user() {
  node - <<'NODE'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.adminUser.count({
    where: {
      username: process.env.ADMIN_DEV_USERNAME || 'admin',
      isActive: true,
    },
  });
  console.log(`本地管理员账号：${count >= 1 ? '存在' : '不存在'}`);
}

main()
  .catch(() => {
    console.log('本地管理员账号：无法检查，请确认数据库已启动');
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
NODE
}

echo "== 绿膳荟本地后台状态检查 =="
check_port 3000 "API 端口 3000"
check_port 3001 "admin-web 端口 3001"
check_http "$API_URL/products" "商品接口 /products"
check_admin_login
check_http "$ADMIN_LOGIN_URL" "后台登录页 /login"
check_admin_user

cat <<EOF

后台地址：$ADMIN_LOGIN_URL
本地账号：$ADMIN_DEV_USERNAME
本地密码：$ADMIN_DEV_PASSWORD

如果发现异常：
1. 请先双击“停止绿膳荟后台.command”
2. 再双击“打开绿膳荟后台.command”
3. 如果页面没有样式，请双击“修复后台显示异常.command”
EOF
