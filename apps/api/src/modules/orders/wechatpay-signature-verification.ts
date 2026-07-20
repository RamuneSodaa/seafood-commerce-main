import { InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { createPublicKey, createVerify } from 'crypto';
import { readFileSync } from 'fs';

type VerificationSource = 'wechatpay-public-key' | 'legacy-platform-certificate';

type VerificationConfig = {
  publicKeyPem: string;
  keyId: string;
  source: VerificationSource;
};

export type WechatPaySignatureInput = {
  body: string;
  timestamp: string;
  nonce: string;
  serial: string;
  signature: string;
};

export type WechatPaySignatureVerificationOptions = {
  context: 'callback' | 'response';
  maxAgeSeconds?: number;
};

function readTrimmed(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function readPublicKeyFromPath(pathValue: string): string {
  try {
    return readFileSync(pathValue, 'utf8').trim();
  } catch {
    throw new InternalServerErrorException('WECHAT_PAY_PUBLIC_KEY_PATH cannot be read');
  }
}

export function hasWechatPayVerificationConfig(): boolean {
  return Boolean(
    readTrimmed('WECHAT_PAY_PUBLIC_KEY_PEM') ||
    readTrimmed('WECHAT_PAY_PUBLIC_KEY_PATH') ||
    readTrimmed('WECHAT_PAY_PUBLIC_KEY_ID') ||
    readTrimmed('WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM') ||
    readTrimmed('WECHAT_PAY_PLATFORM_SERIAL')
  );
}

function readWechatPayVerificationConfig(): VerificationConfig {
  const publicKeyPemDirect = readTrimmed('WECHAT_PAY_PUBLIC_KEY_PEM');
  const publicKeyPath = readTrimmed('WECHAT_PAY_PUBLIC_KEY_PATH');
  const publicKeyId = readTrimmed('WECHAT_PAY_PUBLIC_KEY_ID');

  if (publicKeyPemDirect || publicKeyPath || publicKeyId) {
    if (!publicKeyId) {
      throw new InternalServerErrorException('WECHAT_PAY_PUBLIC_KEY_ID is not configured');
    }

    const publicKeyPem =
      publicKeyPemDirect ||
      (publicKeyPath ? readPublicKeyFromPath(publicKeyPath) : undefined);

    if (!publicKeyPem) {
      throw new InternalServerErrorException(
        'WECHAT_PAY_PUBLIC_KEY_PEM or WECHAT_PAY_PUBLIC_KEY_PATH is not configured'
      );
    }

    return {
      publicKeyPem,
      keyId: publicKeyId,
      source: 'wechatpay-public-key'
    };
  }

  const legacyPem = readTrimmed('WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM');
  const legacySerial = readTrimmed('WECHAT_PAY_PLATFORM_SERIAL');

  if (!legacyPem) {
    throw new InternalServerErrorException('WECHAT_PAY_PUBLIC_KEY_PEM is not configured');
  }
  if (!legacySerial) {
    throw new InternalServerErrorException('WECHAT_PAY_PUBLIC_KEY_ID is not configured');
  }

  return {
    publicKeyPem: legacyPem,
    keyId: legacySerial,
    source: 'legacy-platform-certificate'
  };
}

function requireHeader(value: string, label: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new UnauthorizedException(`Missing ${label}`);
  }
  return normalized;
}

export function verifyWechatPaySignature(
  input: WechatPaySignatureInput,
  options: WechatPaySignatureVerificationOptions
): void {
  const config = readWechatPayVerificationConfig();
  const timestamp = requireHeader(input.timestamp, 'Wechatpay-Timestamp');
  const nonce = requireHeader(input.nonce, 'Wechatpay-Nonce');
  const serial = requireHeader(input.serial, 'Wechatpay-Serial');
  const signature = requireHeader(input.signature, 'Wechatpay-Signature');

  if (serial !== config.keyId) {
    if (
      options.context === 'callback' &&
      config.source === 'legacy-platform-certificate'
    ) {
      throw new UnauthorizedException('Wechat callback platform serial mismatch');
    }
    throw new UnauthorizedException(`Wechat ${options.context} key id mismatch`);
  }

  if (!/^\d+$/.test(timestamp)) {
    throw new UnauthorizedException(
      `Wechat ${options.context} signature timestamp is invalid`
    );
  }

  const timestampSeconds = Number(timestamp);
  if (!Number.isSafeInteger(timestampSeconds) || timestampSeconds <= 0) {
    throw new UnauthorizedException(
      `Wechat ${options.context} signature timestamp is invalid`
    );
  }

  if (options.maxAgeSeconds !== undefined) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - timestampSeconds) > options.maxAgeSeconds) {
      throw new UnauthorizedException(
        `Wechat ${options.context} signature timestamp is outside allowed window`
      );
    }
  }

  let publicKey;
  try {
    publicKey = createPublicKey(config.publicKeyPem);
  } catch {
    throw new InternalServerErrorException(
      'Wechat Pay verification public key is invalid'
    );
  }

  const message = `${timestamp}\n${nonce}\n${input.body}\n`;
  const verifier = createVerify('RSA-SHA256');
  verifier.update(message);
  verifier.end();

  if (!verifier.verify(publicKey, signature, 'base64')) {
    throw new UnauthorizedException(
      `Wechat ${options.context} signature verification failed`
    );
  }
}
