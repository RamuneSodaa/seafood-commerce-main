#!/bin/bash

set -e

PROJECT_ROOT="/Users/lishaotian/Desktop/seafood-commerce-main"
API_PORT="3000"
DB_PORT="5433"

cd "$PROJECT_ROOT"

echo "========== 绿膳荟小程序本地调试启动 =========="

echo ""
echo "== 1. 检查项目目录和必要文件 =="
pwd
test -f package.json || { echo "错误：当前不是项目根目录"; exit 1; }
test -f .env || { echo "错误：缺少 .env"; exit 1; }
test -f .local/env/wechat-miniapp.local || { echo "错误：缺少 .local/env/wechat-miniapp.local"; exit 1; }

echo ""
echo "== 2. 获取 Mac 当前局域网 IP =="
LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
if [ -z "$LAN_IP" ]; then
  LAN_IP="$(ipconfig getifaddr en1 2>/dev/null || true)"
fi
if [ -z "$LAN_IP" ]; then
  echo "错误：没有获取到 Mac 局域网 IP。请确认 Mac 已连接 Wi-Fi。"
  exit 1
fi
echo "当前 Mac 局域网 IP: $LAN_IP"

echo ""
echo "== 3. 检查本地 PostgreSQL 5433 =="
if lsof -nP -iTCP:${DB_PORT} -sTCP:LISTEN >/dev/null 2>&1; then
  echo "PostgreSQL 已在 ${DB_PORT} 端口运行。"
else
  echo "PostgreSQL ${DB_PORT} 未运行，尝试启动项目本地数据库..."

  mkdir -p .local/logs
  PG_LOG=".local/logs/postgres5433_$(date +%Y%m%d_%H%M%S).log"

  PG_CTL=""
  if command -v pg_ctl >/dev/null 2>&1; then
    PG_CTL="$(command -v pg_ctl)"
  elif [ -x "/opt/homebrew/opt/postgresql@16/bin/pg_ctl" ]; then
    PG_CTL="/opt/homebrew/opt/postgresql@16/bin/pg_ctl"
  elif [ -x "/usr/local/opt/postgresql@16/bin/pg_ctl" ]; then
    PG_CTL="/usr/local/opt/postgresql@16/bin/pg_ctl"
  fi

  if [ -z "$PG_CTL" ]; then
    echo "错误：找不到 pg_ctl。请先确认本地 PostgreSQL 是否安装。"
    echo "如果这是重启后第一次遇到，先把这段输出发给我。"
    exit 1
  fi

  if [ ! -d ".local/postgres5433" ]; then
    echo "错误：找不到 .local/postgres5433 数据目录。"
    echo "不要初始化新数据库，先把这段输出发给我。"
    exit 1
  fi

  "$PG_CTL" -D ".local/postgres5433" -l "$PG_LOG" start || {
    echo "错误：PostgreSQL 启动失败，请查看日志：$PG_LOG"
    tail -n 80 "$PG_LOG" || true
    exit 1
  }

  sleep 2

  if lsof -nP -iTCP:${DB_PORT} -sTCP:LISTEN >/dev/null 2>&1; then
    echo "PostgreSQL 启动成功。"
  else
    echo "错误：PostgreSQL 启动后仍未监听 ${DB_PORT}。"
    exit 1
  fi
fi

echo ""
echo "== 4. 停止旧的 API 3000 端口进程 =="
OLD_PIDS="$(lsof -tiTCP:${API_PORT} -sTCP:LISTEN 2>/dev/null || true)"
if [ -n "$OLD_PIDS" ]; then
  echo "发现旧 API 监听进程："
  lsof -nP -iTCP:${API_PORT} -sTCP:LISTEN || true
  for PID in $OLD_PIDS; do
    echo "优雅停止 PID=$PID"
    kill "$PID" 2>/dev/null || true
  done
  sleep 2
else
  echo "没有旧 API 进程。"
fi

echo ""
echo "== 5. 加载本地环境变量，不打印 secret =="
set -a
. ./.env
. ./.local/env/wechat-miniapp.local
set +a
echo "环境变量已加载。"

echo ""
echo "== 6. 启动本地 API 到后台 =="
mkdir -p .local/logs
API_LOG=".local/logs/api_$(date +%Y%m%d_%H%M%S).log"

(
  cd apps/api
  nohup npm start > "../../$API_LOG" 2>&1 &
  echo $! > ../../.local/logs/api_latest.pid
)

echo "API 日志: $API_LOG"
echo "等待 API 启动..."

API_STARTED="no"
for i in $(seq 1 40); do
  if grep -q "Nest application successfully started" "$API_LOG" 2>/dev/null; then
    API_STARTED="yes"
    break
  fi
  sleep 1
done

if [ "$API_STARTED" != "yes" ]; then
  echo "错误：API 启动超时，请查看日志：$API_LOG"
  tail -n 120 "$API_LOG" || true
  exit 1
fi

echo "API 已启动。"

echo ""
echo "== 7. 检查 API 监听状态 =="
lsof -nP -iTCP:${API_PORT} -sTCP:LISTEN || {
  echo "错误：API 没有监听 ${API_PORT} 端口。"
  tail -n 120 "$API_LOG" || true
  exit 1
}

echo ""
echo "== 8. API 健康检查 =="
P1="$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${API_PORT}/products || true)"
P2="$(curl -s -o /dev/null -w "%{http_code}" http://${LAN_IP}:${API_PORT}/products || true)"
S1="$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${API_PORT}/stores || true)"
O1="$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${API_PORT}/orders/authenticated || true)"

echo "127 products HTTP $P1 (expected 200)"
echo "LAN products HTTP $P2 (expected 200)"
echo "stores HTTP $S1 (expected 200)"
echo "orders no-token HTTP $O1 (expected 401)"

if [ "$P1" != "200" ] || [ "$P2" != "200" ] || [ "$S1" != "200" ] || [ "$O1" != "401" ]; then
  echo "错误：健康检查未通过。请把这段输出发给我。"
  exit 1
fi

echo ""
echo "== 9. 使用当前局域网 IP 重新打包小程序 =="
echo "本次小程序 API base: http://${LAN_IP}:${API_PORT}"

TARO_APP_API_BASE_URL="http://${LAN_IP}:${API_PORT}" npm run build:weapp -w @seafood/storefront-miniapp

echo ""
echo "== 10. 检查 dist 里的 API base =="
if grep -R "${LAN_IP}:${API_PORT}" apps/storefront-miniapp/dist >/dev/null 2>&1; then
  echo "dist 已包含当前局域网 API：${LAN_IP}:${API_PORT}"
else
  echo "错误：dist 中没有找到当前局域网 API。"
  exit 1
fi

if grep -R "127.0.0.1:3000" apps/storefront-miniapp/dist >/dev/null 2>&1; then
  echo "警告：dist 里仍然出现 127.0.0.1:3000。请单独检查。"
else
  echo "dist 检查通过：没有 127.0.0.1:3000。"
fi

echo ""
echo "========== 本地调试准备完成 =========="
echo "下一步："
echo "1. 打开微信开发者工具"
echo "2. 确认项目目录是：/Users/lishaotian/Desktop/seafood-commerce-main/apps/storefront-miniapp/dist"
echo "3. 点击 编译"
echo "4. 真机调试重新扫码"
echo "5. 手机和 Mac 连接同一个 Wi-Fi"
echo "6. 手机 VPN / 梯子建议关闭"
echo "7. 手机浏览器可测试：http://${LAN_IP}:${API_PORT}/products"
echo ""
echo "API 后台日志：$API_LOG"
echo "查看 API 日志：tail -f $API_LOG"
