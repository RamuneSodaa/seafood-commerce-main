#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

cat <<'EOF'
这是本地开发缓存修复。
它会停止本项目本地后台服务，并删除 admin-web 的 Next 本地缓存。
不会删除数据库。
不会删除 node_modules。
不会删除 .local/env。
EOF

bash "$PROJECT_ROOT/scripts/stop-admin-local.sh" || true

rm -rf "$PROJECT_ROOT/apps/admin-web/.next"

echo "修复完成，请重新双击打开绿膳荟后台。"
