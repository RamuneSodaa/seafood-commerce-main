#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_DIR="$PROJECT_ROOT/.local/env"
ENV_FILE="$ENV_DIR/wechat-miniapp.local"
MERCHANT_PRIVATE_KEY_FILE="${SEAFOOD_WECHAT_PAY_PRIVATE_KEY_FILE:-$HOME/.seafood-secrets/seafood-commerce/wechat-pay/apiclient_key.pem}"
PLATFORM_PUBLIC_KEY_FILE="${SEAFOOD_WECHAT_PAY_PLATFORM_PUBLIC_KEY_FILE:-$HOME/.seafood-secrets/seafood-commerce/wechat-pay/wechatpay_platform_public_key.pem}"
CALLBACK_PATH="/orders/miniapp-payment-callback"

cd "$PROJECT_ROOT"
mkdir -p "$ENV_DIR"

shell_quote() {
  local value="$1"
  printf "'%s'" "$(printf "%s" "$value" | sed "s/'/'\\\\''/g")"
}

byte_length() {
  node -e "process.stdout.write(String(Buffer.byteLength(process.argv[1] || '', 'utf8')))" "$1"
}

require_file() {
  local file_path="$1"
  local label="$2"

  if [ ! -f "$file_path" ]; then
    echo "$label 不存在：$file_path"
    exit 1
  fi
}

check_private_key_parseable() {
  local file_path="$1"
  node - "$file_path" <<'NODE'
const { createPrivateKey } = require('crypto');
const fs = require('fs');

try {
  createPrivateKey(fs.readFileSync(process.argv[2], 'utf8'));
  process.exit(0);
} catch {
  process.exit(1);
}
NODE
}

check_public_key_parseable() {
  local file_path="$1"
  node - "$file_path" <<'NODE'
const { createPublicKey } = require('crypto');
const fs = require('fs');

try {
  createPublicKey(fs.readFileSync(process.argv[2], 'utf8'));
  process.exit(0);
} catch {
  process.exit(1);
}
NODE
}

validate_notify_url() {
  local notify_url="$1"
  node - "$notify_url" "$CALLBACK_PATH" <<'NODE'
const net = require('net');
const rawUrl = process.argv[2];
const callbackPath = process.argv[3];

function isPrivateHost(hostname) {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (host === '127.0.0.1' || host === '::1' || host === '[::1]') return true;

  if (net.isIP(host)) {
    if (host.startsWith('10.')) return true;
    if (host.startsWith('192.168.')) return true;
    const parts = host.split('.').map((part) => Number(part));
    if (parts.length === 4 && parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (host.startsWith('169.254.')) return true;
  }

  return false;
}

try {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:') {
    console.error('notifyUrl 必须以 https:// 开头。');
    process.exit(1);
  }
  if (isPrivateHost(url.hostname)) {
    console.error('notifyUrl 不能是 localhost、127.0.0.1 或内网地址。');
    process.exit(1);
  }
  if (url.pathname !== callbackPath) {
    console.error(`notifyUrl path 必须是 ${callbackPath}。`);
    process.exit(1);
  }
  process.exit(0);
} catch {
  console.error('notifyUrl 格式不正确。');
  process.exit(1);
}
NODE
}

echo "== 绿膳荟微信支付本地 env 辅助配置 =="

if [ ! -f "$ENV_FILE" ]; then
  echo "找不到旧 env 文件：$ENV_FILE"
  echo "请先准备包含小程序 AppID/AppSecret 的本地私密 env 文件。"
  exit 1
fi

# 只在当前进程读取旧 env，不打印内容。
# shellcheck source=/dev/null
source "$ENV_FILE"

OLD_WECHAT_MINIAPP_APP_ID="${WECHAT_MINIAPP_APP_ID:-}"
OLD_WECHAT_MINIAPP_APP_SECRET="${WECHAT_MINIAPP_APP_SECRET:-}"

if [ -z "$OLD_WECHAT_MINIAPP_APP_ID" ] || [ -z "$OLD_WECHAT_MINIAPP_APP_SECRET" ]; then
  echo "旧 env 中缺少 WECHAT_MINIAPP_APP_ID 或 WECHAT_MINIAPP_APP_SECRET。"
  exit 1
fi

require_file "$MERCHANT_PRIVATE_KEY_FILE" "商户 API 私钥文件"
if ! check_private_key_parseable "$MERCHANT_PRIVATE_KEY_FILE"; then
  echo "商户 API 私钥文件无法解析，请确认不是证书文件或公钥文件。"
  exit 1
fi

printf "请输入微信支付 APIv3 密钥（隐藏输入，不会回显）："
IFS= read -r -s WECHAT_PAY_API_V3_KEY_INPUT
printf "\n"

if [ "$(byte_length "$WECHAT_PAY_API_V3_KEY_INPUT")" != "32" ]; then
  echo "APIv3 密钥长度必须是 32 bytes，请重新执行脚本。"
  exit 1
fi

printf "请输入公网 HTTPS notifyUrl，例如 https://xxxxx.trycloudflare.com/orders/miniapp-payment-callback："
IFS= read -r WECHAT_PAY_NOTIFY_URL_INPUT

validate_notify_url "$WECHAT_PAY_NOTIFY_URL_INPUT"

if [ ! -f "$PLATFORM_PUBLIC_KEY_FILE" ]; then
  echo
  echo "未找到微信支付平台公钥文件：$PLATFORM_PUBLIC_KEY_FILE"
  echo "接下来请粘贴“微信支付平台公钥 PEM”。"
  echo "注意：不是商户 apiclient_cert.pem，也不是商户 apiclient_key.pem。"
  echo "保存并退出 nano 后脚本会继续。"
  if [ ! -t 0 ]; then
    echo "当前不是交互终端，无法打开 nano。请手动创建平台公钥文件后重新执行。"
    exit 1
  fi
  nano "$PLATFORM_PUBLIC_KEY_FILE"
fi

require_file "$PLATFORM_PUBLIC_KEY_FILE" "微信支付平台公钥文件"
if ! check_public_key_parseable "$PLATFORM_PUBLIC_KEY_FILE"; then
  echo "微信支付平台公钥文件无法解析，请确认粘贴的是平台公钥 PEM。"
  exit 1
fi

BACKUP_FILE="$ENV_FILE.backup.$(date '+%Y%m%d_%H%M%S')"
cp -p "$ENV_FILE" "$BACKUP_FILE"

cat > "$ENV_FILE" <<EOF
# 绿膳荟小程序 / 微信支付本地联调环境
# 本文件只用于本机开发联调，不要提交、不要发给别人、不要放进 review pack。

export WECHAT_MINIAPP_APP_ID=$(shell_quote "$OLD_WECHAT_MINIAPP_APP_ID")
export WECHAT_MINIAPP_APP_SECRET=$(shell_quote "$OLD_WECHAT_MINIAPP_APP_SECRET")

export WECHAT_PAY_MODE="direct"
export WECHAT_PAY_MERCHANT_ID="1744602243"
export WECHAT_PAY_MERCHANT_SERIAL="68B01504E4067099904649463D5D0B04EFCCC3BF"
export WECHAT_PAY_MERCHANT_PRIVATE_KEY_PEM="\$(cat '$MERCHANT_PRIVATE_KEY_FILE')"
export WECHAT_PAY_NOTIFY_URL=$(shell_quote "$WECHAT_PAY_NOTIFY_URL_INPUT")
export WECHAT_PAY_API_V3_KEY=$(shell_quote "$WECHAT_PAY_API_V3_KEY_INPUT")
export WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM="\$(cat '$PLATFORM_PUBLIC_KEY_FILE')"
export WECHAT_PAY_PLATFORM_SERIAL="PUB_KEY_ID_0117446022432026051600292104002004"
EOF

chmod 600 "$ENV_FILE"
chmod 600 "$MERCHANT_PRIVATE_KEY_FILE"
chmod 600 "$PLATFORM_PUBLIC_KEY_FILE"

echo
echo "已备份旧 env：$BACKUP_FILE"
echo "已写入新 env：$ENV_FILE"
echo "已设置私密文件权限为 600。"
echo
echo "== 脱敏预检结果 =="
# shellcheck source=/dev/null
source "$ENV_FILE"
node scripts/check-wechat-pay-env-local.js
