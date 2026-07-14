#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.local/env/wechat-miniapp.local"
ADMIN_ENV_FILE="$PROJECT_ROOT/.local/env/admin.local"
RUNTIME_DIR="$PROJECT_ROOT/.local/runtime/admin-local"
API_PID_FILE="$RUNTIME_DIR/api.pid"
ADMIN_WEB_PID_FILE="$RUNTIME_DIR/admin-web.pid"
API_LOG_FILE="$RUNTIME_DIR/api.log"
ADMIN_WEB_LOG_FILE="$RUNTIME_DIR/admin-web.log"
API_URL="http://127.0.0.1:3000"
ADMIN_WEB_URL="http://127.0.0.1:3001"
ADMIN_LOGIN_URL="$ADMIN_WEB_URL/login"

cd "$PROJECT_ROOT"
mkdir -p "$RUNTIME_DIR"

require_command() {
  local command_name="$1"
  local install_hint="$2"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "$install_hint"
    exit 1
  fi
}

require_command "lsof" "这台电脑缺少本地后台端口检查能力，请联系开发同事处理。"
require_command "curl" "这台电脑缺少本地后台接口检查能力，请联系开发同事处理。"
require_command "node" "这台电脑还没有安装运行环境，请联系开发同事安装 Node.js 后再使用。"
require_command "npm" "这台电脑还没有安装运行环境，请联系开发同事安装 Node.js 后再使用。"
require_command "npx" "这台电脑还没有安装运行环境，请联系开发同事安装 Node.js 后再使用。"

if [ ! -f "$ENV_FILE" ]; then
  echo "找不到本地环境变量文件：$ENV_FILE"
  echo "缺少本地环境配置文件，请联系开发同事，不要自己新建。"
  exit 1
fi

# 只读取本地私密环境变量文件，不打印文件内容。
# shellcheck source=/dev/null
source "$ENV_FILE"

# 本地管理员凭据只保存在被 Git 忽略的 admin.local。
if [ ! -f "$ADMIN_ENV_FILE" ]; then
  bash "$SCRIPT_DIR/ensure-admin-local-env.sh"
fi

# shellcheck source=/dev/null
source "$ADMIN_ENV_FILE"

export NEXT_PUBLIC_API_BASE="$API_URL"

API_PID=""
ADMIN_WEB_PID=""

get_pid_command() {
  local pid="$1"
  ps -p "$pid" -o command= 2>/dev/null || true
}

get_pid_cwd() {
  local pid="$1"
  lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1
}

is_project_process() {
  local pid="$1"
  local command
  local cwd

  command="$(get_pid_command "$pid")"
  cwd="$(get_pid_cwd "$pid")"

  [[ "$cwd" == "$PROJECT_ROOT"* ]] || [[ "$command" == *"@seafood/api"* ]] || [[ "$command" == *"admin-web"* ]] || [[ "$command" == *"next-server"* ]]
}

cleanup() {
  local pid

  if [ -z "${ADMIN_WEB_PID:-}" ] && [ -z "${API_PID:-}" ]; then
    return
  fi

  echo
  echo "正在关闭本地商家后台服务..."

  if [ -n "${ADMIN_WEB_PID:-}" ] && kill -0 "$ADMIN_WEB_PID" 2>/dev/null; then
    kill "$ADMIN_WEB_PID" 2>/dev/null || true
  fi

  if [ -n "${API_PID:-}" ] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
  fi

  wait "$ADMIN_WEB_PID" "$API_PID" 2>/dev/null || true

  for pid in "$ADMIN_WEB_PID" "$API_PID"; do
    if [ -n "$pid" ]; then
      if [ -f "$ADMIN_WEB_PID_FILE" ] && [ "$(cat "$ADMIN_WEB_PID_FILE" 2>/dev/null || true)" = "$pid" ]; then
        rm -f "$ADMIN_WEB_PID_FILE"
      fi
      if [ -f "$API_PID_FILE" ] && [ "$(cat "$API_PID_FILE" 2>/dev/null || true)" = "$pid" ]; then
        rm -f "$API_PID_FILE"
      fi
    fi
  done
}

trap cleanup INT TERM EXIT

check_port_free() {
  local port="$1"
  local label="$2"
  local process_ids
  local pid
  local found_project_process=0

  process_ids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
  if [ -z "$process_ids" ]; then
    return 0
  fi

  for pid in $process_ids; do
    if is_project_process "$pid"; then
      found_project_process=1
    fi
  done

  if [ "$found_project_process" = "1" ]; then
    echo "$label 端口 $port 已被本项目旧服务占用，请先双击“停止绿膳荟后台.command”或“stop-admin-mac.command”。"
    echo "停止后再重新双击打开后台。"
  else
    echo "$label 端口 $port 已被其他程序占用，请不要随便关闭。"
    echo "请截图发给开发同事处理。"
  fi

  exit 1
}

wait_for_http() {
  local url="$1"
  local label="$2"
  local attempts="${3:-60}"
  local status
  local i

  for i in $(seq 1 "$attempts"); do
    status="$(curl -sS -o /tmp/admin-local-healthcheck.out -w "%{http_code}" "$url" 2>/dev/null || true)"
    if [ "$status" -ge 200 ] 2>/dev/null && [ "$status" -lt 500 ] 2>/dev/null; then
      echo "$label 已可访问：$url"
      return 0
    fi

    sleep 1
  done

  echo "$label 暂时不可访问：$url"
  echo "最后一次 HTTP 状态：${status:-无响应}"
  if [ -s /tmp/admin-local-healthcheck.out ]; then
    echo "响应摘要："
    head -c 300 /tmp/admin-local-healthcheck.out
    echo
  fi
  return 1
}

ensure_dev_admin_user() {
  node - <<'NODE'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.adminUser.findMany({
    select: {
      username: true,
      displayName: true,
      role: true,
      isActive: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const devAdmin = users.find((user) => user.username === process.env.ADMIN_DEV_USERNAME && user.isActive);
  console.log(`AdminUser count: ${users.length}`);
  console.log(`Dev admin exists: ${devAdmin ? 'yes' : 'no'}`);

  if (users.length < 1 || !devAdmin) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
NODE
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
    echo "后台管理员登录接口验证通过。"
    return 0
  fi

  echo "后台管理员登录接口验证失败，HTTP 状态：${status:-无响应}"
  if [ -s /tmp/admin-local-login-check.out ]; then
    echo "响应摘要："
    head -c 300 /tmp/admin-local-login-check.out
    echo
  fi
  return 1
}

echo "== 检查本地端口 =="
check_port_free 3000 "API"
check_port_free 3001 "admin-web"

echo
echo "== 同步本地数据库结构 =="
npx prisma db push

echo
echo "== 写入本地种子数据 =="
npx prisma db seed

echo
echo "== 确认本地管理员账号 =="
if ! ensure_dev_admin_user; then
  echo "本地管理员账号未正确创建，请检查 seed 输出。"
  exit 1
fi

echo
echo "== 启动 API 服务 =="
: > "$API_LOG_FILE"
npm run start -w @seafood/api > "$API_LOG_FILE" 2>&1 &
API_PID=$!
echo "$API_PID" > "$API_PID_FILE"

if ! wait_for_http "$API_URL/products" "API 商品接口" 60; then
  echo "API 服务启动失败，请查看日志：$API_LOG_FILE"
  tail -80 "$API_LOG_FILE" || true
  exit 1
fi

if ! check_admin_login; then
  echo "后台登录验证失败，请确认 seed 已创建本地管理员。"
  exit 1
fi

echo
echo "== 启动 admin-web 服务 =="
: > "$ADMIN_WEB_LOG_FILE"
npm run dev -w @seafood/admin-web -- -H 127.0.0.1 -p 3001 > "$ADMIN_WEB_LOG_FILE" 2>&1 &
ADMIN_WEB_PID=$!
echo "$ADMIN_WEB_PID" > "$ADMIN_WEB_PID_FILE"

if ! wait_for_http "$ADMIN_LOGIN_URL" "admin-web 登录页" 90; then
  echo "admin-web 服务启动失败，请查看日志：$ADMIN_WEB_LOG_FILE"
  tail -80 "$ADMIN_WEB_LOG_FILE" || true
  exit 1
fi

cat <<EOF

后台已启动
地址：http://127.0.0.1:3001/login
账号：$ADMIN_DEV_USERNAME
密码：$ADMIN_DEV_PASSWORD
停止方式：双击“停止绿膳荟后台.command”或在当前窗口按 Ctrl+C
EOF

if command -v open >/dev/null 2>&1; then
  open "$ADMIN_LOGIN_URL" >/dev/null 2>&1 || echo "无法自动打开浏览器，请手动访问：$ADMIN_LOGIN_URL"
else
  echo "请手动访问：$ADMIN_LOGIN_URL"
fi

while true; do
  if ! kill -0 "$API_PID" 2>/dev/null; then
    echo "API 服务已退出，正在关闭本地商家后台。"
    exit 1
  fi

  if ! kill -0 "$ADMIN_WEB_PID" 2>/dev/null; then
    echo "admin-web 服务已退出，正在关闭本地商家后台。"
    exit 1
  fi

  sleep 2
done
