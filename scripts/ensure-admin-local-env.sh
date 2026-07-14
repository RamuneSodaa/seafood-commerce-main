#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_DIR="$PROJECT_ROOT/.local/env"
ADMIN_ENV_FILE="$ENV_DIR/admin.local"

mkdir -p "$ENV_DIR"

chmod 700 "$PROJECT_ROOT/.local" "$ENV_DIR" 2>/dev/null || true

if [ -f "$ADMIN_ENV_FILE" ]; then
  chmod 600 "$ADMIN_ENV_FILE"

  echo "本地管理员配置已经存在："
  echo "$ADMIN_ENV_FILE"
  exit 0
fi

if ! command -v node >/dev/null 2>&1; then
  echo "缺少 Node.js，无法生成随机本地管理员凭据。"
  exit 1
fi

ADMIN_PASSWORD="$(
  node -e \
    "process.stdout.write(require('crypto').randomBytes(18).toString('base64url'))"
)"

ADMIN_SECRET="$(
  node -e \
    "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"
)"

shell_quote() {
  printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"
}

cat > "$ADMIN_ENV_FILE" <<EOF2
# Local-only administrator credentials.
# This file is ignored by Git.

export ADMIN_DEV_USERNAME='admin'
export ADMIN_DEV_PASSWORD=$(shell_quote "$ADMIN_PASSWORD")
export ADMIN_DEV_DISPLAY_NAME='本地管理员'
export ADMIN_AUTH_SECRET=$(shell_quote "$ADMIN_SECRET")
EOF2

chmod 600 "$ADMIN_ENV_FILE"

echo
echo "本地管理员配置已生成："
echo "$ADMIN_ENV_FILE"
echo
echo "用户名：admin"
echo "本地密码：$ADMIN_PASSWORD"
echo
echo "请只保存在本机，不要上传到 GitHub。"
