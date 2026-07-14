#!/usr/bin/env node
const { createPrivateKey, createPublicKey } = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');
const net = require('net');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const CALLBACK_PATH = '/orders/miniapp-payment-callback';

function mask(value, head, tail) {
  if (!value) return 'missing';
  if (value.length <= head + tail) return `present length=${value.length}`;
  return `${value.slice(0, head)}...${value.slice(-tail)} length=${value.length}`;
}

function readEnv(name) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function normalizePem(value) {
  return value.replace(/\\n/g, '\n');
}

function parsePrivateKey(value) {
  if (!value) return false;
  try {
    createPrivateKey(normalizePem(value));
    return true;
  } catch {
    return false;
  }
}

function parsePublicKey(value) {
  if (!value) return false;
  try {
    createPublicKey(normalizePem(value));
    return true;
  } catch {
    return false;
  }
}

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

function safeNotifyUrl(value) {
  if (!value) {
    return {
      present: false,
      validUrl: false,
      https: false,
      publicHost: false,
      pathOk: false,
      safeDisplay: 'missing'
    };
  }

  try {
    const url = new URL(value);
    return {
      present: true,
      validUrl: true,
      https: url.protocol === 'https:',
      publicHost: !isPrivateHost(url.hostname),
      pathOk: url.pathname === CALLBACK_PATH,
      safeDisplay: `${url.origin}${url.pathname}`
    };
  } catch {
    return {
      present: true,
      validUrl: false,
      https: false,
      publicHost: false,
      pathOk: false,
      safeDisplay: 'invalid-url'
    };
  }
}

function requestUrl(urlValue) {
  return new Promise((resolve) => {
    let url;
    try {
      url = new URL(urlValue);
    } catch {
      resolve({ attempted: false, reachable: false, statusCode: null, reason: 'invalid-url' });
      return;
    }

    const client = url.protocol === 'https:' ? https : http;
    const request = client.request(
      url,
      {
        method: 'GET',
        timeout: 5000,
        headers: {
          'User-Agent': 'seafood-commerce-wechat-pay-preflight'
        }
      },
      (response) => {
        response.resume();
        resolve({
          attempted: true,
          reachable: Boolean(response.statusCode && response.statusCode >= 200 && response.statusCode < 500),
          statusCode: response.statusCode || null,
          reason: 'http-response'
        });
      }
    );

    request.on('timeout', () => {
      request.destroy(new Error('timeout'));
    });

    request.on('error', (error) => {
      resolve({
        attempted: true,
        reachable: false,
        statusCode: null,
        reason: error.code || error.message || 'request-error'
      });
    });

    request.end();
  });
}

function readProjectAppIds() {
  const files = [
    'project.config.json',
    'apps/storefront-miniapp/project.config.json',
    'apps/storefront-miniapp/dist/project.config.json'
  ];

  return files.map((file) => {
    try {
      const config = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, file), 'utf8'));
      return { file, appid: config.appid || '' };
    } catch {
      return { file, appid: '' };
    }
  });
}

function printCheck(name, status, detail) {
  console.log(`${name}: ${status}${detail ? ` (${detail})` : ''}`);
}

async function main() {
  const mode = (readEnv('WECHAT_PAY_MODE') || 'direct').toLowerCase();
  const appId = readEnv('WECHAT_MINIAPP_APP_ID');
  const appSecret = readEnv('WECHAT_MINIAPP_APP_SECRET');
  const notifyUrlValue = readEnv('WECHAT_PAY_NOTIFY_URL');
  const notify = safeNotifyUrl(notifyUrlValue);
  const apiV3Key = readEnv('WECHAT_PAY_API_V3_KEY');
  const platformPublicKey = readEnv('WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM');
  const platformSerial = readEnv('WECHAT_PAY_PLATFORM_SERIAL');

  const directMerchantId = readEnv('WECHAT_PAY_MERCHANT_ID');
  const directMerchantSerial = readEnv('WECHAT_PAY_MERCHANT_SERIAL');
  const directPrivateKey = readEnv('WECHAT_PAY_MERCHANT_PRIVATE_KEY_PEM');
  const spMerchantId = readEnv('WECHAT_PAY_SP_MERCHANT_ID');
  const spMerchantSerial = readEnv('WECHAT_PAY_SP_MERCHANT_SERIAL');
  const spPrivateKey = readEnv('WECHAT_PAY_SP_MERCHANT_PRIVATE_KEY_PEM');
  const subMerchantId = readEnv('WECHAT_PAY_SUB_MERCHANT_ID');

  const projectAppIds = readProjectAppIds();
  const projectAppIdsPresent = projectAppIds.filter((item) => item.appid);
  const projectAppIdConsistent = projectAppIdsPresent.length > 0
    && projectAppIdsPresent.every((item) => item.appid === projectAppIdsPresent[0].appid);
  const envAppIdMatchesProject = Boolean(appId)
    && projectAppIdsPresent.some((item) => item.appid === appId);

  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok, detail });

  add('WECHAT_MINIAPP_APP_ID', Boolean(appId), mask(appId, 4, 4));
  add('WECHAT_MINIAPP_APP_SECRET', Boolean(appSecret), appSecret ? `present length=${appSecret.length}` : 'missing');
  add('project AppID consistency', projectAppIdConsistent, projectAppIdsPresent.map((item) => `${item.file}:${mask(item.appid, 4, 4)}`).join('; '));
  add('env AppID matches project config', envAppIdMatchesProject, envAppIdMatchesProject ? 'yes' : 'no');
  add('WECHAT_PAY_MODE', mode === 'direct' || mode === 'partner', mode || 'direct');

  if (mode === 'partner') {
    add('WECHAT_PAY_SP_MERCHANT_ID', Boolean(spMerchantId), mask(spMerchantId, 3, 3));
    add('WECHAT_PAY_SP_MERCHANT_SERIAL', Boolean(spMerchantSerial), mask(spMerchantSerial, 4, 4));
    add('WECHAT_PAY_SP_MERCHANT_PRIVATE_KEY_PEM', Boolean(spPrivateKey) && parsePrivateKey(spPrivateKey), `present=${Boolean(spPrivateKey)} parseable=${Boolean(spPrivateKey) && parsePrivateKey(spPrivateKey)}`);
    add('WECHAT_PAY_SUB_MERCHANT_ID', Boolean(subMerchantId), mask(subMerchantId, 3, 3));
  } else {
    add('WECHAT_PAY_MERCHANT_ID', Boolean(directMerchantId), mask(directMerchantId, 3, 3));
    add('WECHAT_PAY_MERCHANT_SERIAL', Boolean(directMerchantSerial), mask(directMerchantSerial, 4, 4));
    add('WECHAT_PAY_MERCHANT_PRIVATE_KEY_PEM', Boolean(directPrivateKey) && parsePrivateKey(directPrivateKey), `present=${Boolean(directPrivateKey)} parseable=${Boolean(directPrivateKey) && parsePrivateKey(directPrivateKey)}`);
  }

  add('WECHAT_PAY_NOTIFY_URL', notify.present && notify.validUrl, notify.safeDisplay);
  add('notifyUrl HTTPS', notify.https, notify.present ? String(notify.https) : 'missing');
  add('notifyUrl public host', notify.publicHost, notify.present ? String(notify.publicHost) : 'missing');
  add('notifyUrl callback path', notify.pathOk, notify.present ? String(notify.pathOk) : 'missing');
  add('WECHAT_PAY_API_V3_KEY', Boolean(apiV3Key) && Buffer.byteLength(apiV3Key, 'utf8') === 32, apiV3Key ? `present bytes=${Buffer.byteLength(apiV3Key, 'utf8')} lengthOk=${Buffer.byteLength(apiV3Key, 'utf8') === 32}` : 'missing');
  add('WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM', Boolean(platformPublicKey) && parsePublicKey(platformPublicKey), `present=${Boolean(platformPublicKey)} parseable=${Boolean(platformPublicKey) && parsePublicKey(platformPublicKey)}`);
  add('WECHAT_PAY_PLATFORM_SERIAL', Boolean(platformSerial), mask(platformSerial, 4, 4));

  console.log('== WeChat Pay local env preflight ==');
  console.log(`generatedAt=${new Date().toISOString()}`);
  console.log(`mode=${mode || 'direct'}`);

  for (const check of checks) {
    printCheck(check.name, check.ok ? 'PASS' : 'FAIL', check.detail);
  }

  let reachability = { attempted: false, reachable: false, statusCode: null, reason: 'not-attempted' };
  if (notify.present && notify.validUrl && notify.https && notify.publicHost && notify.pathOk) {
    reachability = await requestUrl(notifyUrlValue);
  }

  printCheck(
    'notifyUrl reachability',
    reachability.reachable ? 'PASS' : 'FAIL',
    `attempted=${reachability.attempted} status=${reachability.statusCode ?? 'n/a'} reason=${reachability.reason}`
  );

  const nonNotifyOk = checks
    .filter((check) => !check.name.startsWith('notifyUrl') && check.name !== 'WECHAT_PAY_NOTIFY_URL')
    .every((check) => check.ok);
  const notifyShapeOk = notify.present && notify.validUrl && notify.https && notify.publicHost && notify.pathOk;

  let gateStatus = 'READY_FOR_LOW_AMOUNT_REAL_DEVICE_TEST';
  if (!nonNotifyOk) {
    gateStatus = 'BLOCKED_ENV_MISSING';
  } else if (!notifyShapeOk || !reachability.reachable) {
    gateStatus = 'BLOCKED_NOTIFY_URL';
  }

  const failedChecks = checks.filter((check) => !check.ok).map((check) => check.name);
  if (!reachability.reachable) {
    failedChecks.push('notifyUrl reachability');
  }

  console.log(`gateStatus=${gateStatus}`);
  console.log(`failedChecks=${failedChecks.length ? failedChecks.join(', ') : 'none'}`);
}

main().catch((error) => {
  console.error(`preflight failed: ${error.message || String(error)}`);
  process.exit(1);
});
