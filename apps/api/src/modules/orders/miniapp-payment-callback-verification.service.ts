import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { createDecipheriv } from 'crypto';
import { verifyWechatPaySignature } from './wechatpay-signature-verification';
import { MiniappPaymentCallbackDto } from './dto/order-workflow.dto';

type SupportedMiniappPaymentCallbackProvider = 'wechat';

export type MiniappPaymentCallbackVerificationAttempt = {
  stage: 'CALLBACK_VERIFICATION';
  provider: SupportedMiniappPaymentCallbackProvider;
  status: 'READY_FOR_SIGNATURE_VERIFICATION';
  callbackPayload: Record<string, unknown>;
  raw?: unknown;
  message: string;
};

export type VerifiedWechatMiniappPaymentCallbackBusinessInput = {
  orderNo: string;
  paymentRef: string;
  paidAmountCents: number;
};

export type ExtractedWechatMiniappPaymentCallbackPayload = {
  merchantOrderNo: string;
  transactionId: string;
  paidAmountCents: number;
};

export type WechatCallbackSignatureVerificationInput = {
  rawBody: string;
  wechatpayTimestamp: string;
  wechatpayNonce: string;
  wechatpaySerial: string;
  wechatpaySignature: string;
};

export type VerifiedWechatMiniappPaymentCallback = {
  provider: SupportedMiniappPaymentCallbackProvider;
  callbackPayload: Record<string, unknown>;
};

type WechatPayEncryptedResource = {
  algorithm: string;
  ciphertext: string;
  associated_data?: string;
  nonce: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readOptionalWechatVerificationConfig(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function readWechatPayApiV3KeyBuffer(): Buffer {
  const value = process.env.WECHAT_PAY_API_V3_KEY?.trim();

  if (!value) {
    throw new InternalServerErrorException('WECHAT_PAY_API_V3_KEY is not configured');
  }

  const key = Buffer.from(value, 'utf8');
  if (key.length !== 32) {
    throw new InternalServerErrorException('WECHAT_PAY_API_V3_KEY must be 32 bytes');
  }

  return key;
}

function assertNonEmptyString(value: string, label: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new BadRequestException(`Missing ${label}`);
  }

  return normalized;
}

function readOptionalNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new BadRequestException(`${label} must be an object`);
  }

  return value;
}

function assertWechatPayEncryptedResource(value: unknown): WechatPayEncryptedResource {
  const resource = assertRecord(value, 'Wechat callback resource');
  const algorithm = readOptionalNonEmptyString(resource.algorithm);
  const ciphertext = readOptionalNonEmptyString(resource.ciphertext);
  const nonce = readOptionalNonEmptyString(resource.nonce);
  const associatedData = readOptionalNonEmptyString(resource.associated_data);

  if (algorithm !== 'AEAD_AES_256_GCM') {
    throw new BadRequestException('Unsupported Wechat callback resource algorithm');
  }

  if (!ciphertext) {
    throw new BadRequestException('Wechat callback resource missing ciphertext');
  }

  if (!nonce) {
    throw new BadRequestException('Wechat callback resource missing nonce');
  }

  return {
    algorithm,
    ciphertext,
    nonce,
    associated_data: associatedData
  };
}

function decryptWechatPayResource(resource: WechatPayEncryptedResource): Record<string, unknown> {
  try {
    const key = readWechatPayApiV3KeyBuffer();
    const encrypted = Buffer.from(resource.ciphertext, 'base64');

    if (encrypted.length <= 16) {
      throw new Error('ciphertext too short');
    }

    const authTag = encrypted.subarray(encrypted.length - 16);
    const ciphertext = encrypted.subarray(0, encrypted.length - 16);
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(resource.nonce, 'utf8'));

    if (resource.associated_data) {
      decipher.setAAD(Buffer.from(resource.associated_data, 'utf8'));
    }

    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    const parsed = JSON.parse(decrypted) as unknown;

    return assertRecord(parsed, 'Decrypted Wechat callback resource');
  } catch (error) {
    if (error instanceof InternalServerErrorException || error instanceof BadRequestException) {
      throw error;
    }

    throw new BadRequestException('Wechat callback resource decrypt failed');
  }
}

function readWechatPaymentMode(): 'direct' | 'partner' {
  const rawMode = process.env.WECHAT_PAY_MODE?.trim().toLowerCase();

  if (rawMode === 'direct' || rawMode === 'partner') {
    return rawMode;
  }

  if (!rawMode) {
    throw new InternalServerErrorException('WECHAT_PAY_MODE must be explicitly configured as "direct" or "partner"');
  }

  throw new InternalServerErrorException('WECHAT_PAY_MODE must be "direct" or "partner"');
}

function readRequiredWechatVerificationConfig(name: string): string {
  const value = readOptionalWechatVerificationConfig(name);
  if (!value) {
    throw new InternalServerErrorException(`${name} is not configured`);
  }
  return value;
}

function assertRequiredConfigMatch(label: string, envName: string, actual: unknown) {
  const expected = readRequiredWechatVerificationConfig(envName);
  const actualValue = readOptionalNonEmptyString(actual);

  if (!actualValue) {
    throw new BadRequestException(`Wechat callback missing ${label}`);
  }

  if (expected !== actualValue) {
    throw new BadRequestException(`Wechat callback ${label} mismatch`);
  }
}

function assertWechatCallbackConfigConsistency(payload: Record<string, unknown>) {
  const mode = readWechatPaymentMode();

  if (mode === 'partner') {
    assertRequiredConfigMatch('sp_mchid', 'WECHAT_PAY_SP_MERCHANT_ID', payload.sp_mchid);
    assertRequiredConfigMatch('sub_mchid', 'WECHAT_PAY_SUB_MERCHANT_ID', payload.sub_mchid);
    assertRequiredConfigMatch('sub_appid', 'WECHAT_MINIAPP_APP_ID', payload.sub_appid);
    return;
  }

  assertRequiredConfigMatch('mchid', 'WECHAT_PAY_MERCHANT_ID', payload.mchid);
  assertRequiredConfigMatch('appid', 'WECHAT_MINIAPP_APP_ID', payload.appid);
}

function hasWechatPayResource(callbackPayload: Record<string, unknown>): boolean {
  return isRecord(callbackPayload.resource);
}

@Injectable()
export class MiniappPaymentCallbackVerificationService {
  buildVerificationAttempt(dto: MiniappPaymentCallbackDto): MiniappPaymentCallbackVerificationAttempt {
    const normalizedProvider = (dto.provider || 'wechat').trim().toLowerCase();

    if (normalizedProvider !== 'wechat') {
      throw new BadRequestException(`Unsupported miniapp payment callback provider: ${dto.provider}`);
    }

    if (!isRecord(dto.callbackPayload)) {
      throw new BadRequestException('Miniapp payment callback payload must be an object');
    }

    return {
      stage: 'CALLBACK_VERIFICATION',
      provider: 'wechat',
      status: 'READY_FOR_SIGNATURE_VERIFICATION',
      callbackPayload: dto.callbackPayload,
      raw: dto.raw,
      message: 'Miniapp payment callback payload accepted for signature verification'
    };
  }

  verifyWechatCallbackSignature(
    callbackPayload: Record<string, unknown>,
    input: WechatCallbackSignatureVerificationInput
  ): VerifiedWechatMiniappPaymentCallback {
    const rawBody = assertNonEmptyString(input.rawBody, 'raw Wechat callback body');
    const timestamp = assertNonEmptyString(input.wechatpayTimestamp, 'Wechatpay-Timestamp header');
    const nonce = assertNonEmptyString(input.wechatpayNonce, 'Wechatpay-Nonce header');
    const serial = assertNonEmptyString(input.wechatpaySerial, 'Wechatpay-Serial header');
    const signature = assertNonEmptyString(input.wechatpaySignature, 'Wechatpay-Signature header');

    verifyWechatPaySignature(
      {
        body: rawBody,
        timestamp,
        nonce,
        serial,
        signature
      },
      {
        context: 'callback',
        maxAgeSeconds: 300
      }
    );

    return {
      provider: 'wechat',
      callbackPayload
    };
  }

  assertNativeWechatTransactionCallbackEnvelope(
    callbackPayload: Record<string, unknown>
  ): void {
    if (!hasWechatPayResource(callbackPayload)) {
      throw new BadRequestException('Wechat callback missing encrypted resource');
    }
  }

  extractWechatCallbackPayloadForBusinessMapping(
    callbackPayload: Record<string, unknown>
  ): ExtractedWechatMiniappPaymentCallbackPayload {
    const nativeResource = hasWechatPayResource(callbackPayload);
    const businessPayload = nativeResource
      ? decryptWechatPayResource(assertWechatPayEncryptedResource(callbackPayload.resource))
      : callbackPayload;
    const tradeState = readOptionalNonEmptyString(businessPayload.trade_state);

    if (nativeResource) {
      const eventType = readOptionalNonEmptyString(callbackPayload.event_type);
      if (eventType !== 'TRANSACTION.SUCCESS') {
        throw new BadRequestException('Wechat callback event_type is not TRANSACTION.SUCCESS');
      }
      if (!tradeState) {
        throw new BadRequestException('Wechat callback payload missing trade_state');
      }
      if (tradeState !== 'SUCCESS') {
        throw new BadRequestException(`Wechat payment trade_state is not SUCCESS: ${tradeState}`);
      }
      assertWechatCallbackConfigConsistency(businessPayload);
    } else if (tradeState && tradeState !== 'SUCCESS') {
      throw new BadRequestException(`Wechat payment trade_state is not SUCCESS: ${tradeState}`);
    }

    const merchantOrderNo = businessPayload.merchantOrderNo ?? businessPayload.out_trade_no;
    const transactionId = businessPayload.transactionId ?? businessPayload.transaction_id;
    const amount = isRecord(businessPayload.amount) ? businessPayload.amount : undefined;
    const paidAmountCents = businessPayload.paidAmountCents ?? amount?.total;

    if (typeof merchantOrderNo !== 'string' || !merchantOrderNo.trim()) {
      throw new BadRequestException('Wechat callback payload missing merchantOrderNo');
    }

    if (typeof transactionId !== 'string' || !transactionId.trim()) {
      throw new BadRequestException('Wechat callback payload missing transactionId');
    }

    if (typeof paidAmountCents !== 'number' || !Number.isInteger(paidAmountCents) || paidAmountCents <= 0) {
      throw new BadRequestException('Wechat callback payload missing valid paidAmountCents');
    }

    return {
      merchantOrderNo,
      transactionId,
      paidAmountCents
    };
  }

  mapVerifiedWechatCallbackToBusinessInput(verifiedCallback: {
    merchantOrderNo: string;
    transactionId: string;
    paidAmountCents: number;
    raw?: unknown;
  }): VerifiedWechatMiniappPaymentCallbackBusinessInput {
    void verifiedCallback.raw;

    return {
      orderNo: verifiedCallback.merchantOrderNo,
      paymentRef: verifiedCallback.transactionId,
      paidAmountCents: verifiedCallback.paidAmountCents
    };
  }
}
