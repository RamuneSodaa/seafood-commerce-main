import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from '@nestjs/common';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

const PRODUCT_ASSET_OBJECT_PREFIX = 'products/dry/';
const PRODUCT_ASSET_FILENAME_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}\.(?:jpe?g|png|webp|gif|avif)$/i;

export const PRODUCT_ASSET_CACHE_CONTROL = 'public, max-age=86400';
export const PRODUCT_ASSET_MAX_BYTES = 10 * 1024 * 1024;

type ProductAssetConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

export type ProductAssetReadResult = {
  body: Buffer;
  contentType: string;
  contentLength: number;
  etag?: string;
};

@Injectable()
export class ProductAssetsService {
  private client?: S3Client;

  private readConfig(): ProductAssetConfig | null {
    const endpoint = process.env.PRODUCT_ASSETS_S3_ENDPOINT?.trim();
    const region = process.env.PRODUCT_ASSETS_S3_REGION?.trim();
    const bucket = process.env.PRODUCT_ASSETS_S3_BUCKET?.trim();
    const accessKeyId = process.env.PRODUCT_ASSETS_S3_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.PRODUCT_ASSETS_S3_SECRET_ACCESS_KEY?.trim();

    if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey) {
      return null;
    }

    let parsedEndpoint: URL;
    try {
      parsedEndpoint = new URL(endpoint);
    } catch {
      throw new ServiceUnavailableException('Product asset storage endpoint is invalid');
    }

    if (parsedEndpoint.protocol !== 'https:') {
      throw new ServiceUnavailableException('Product asset storage endpoint must use HTTPS');
    }

    return {
      endpoint,
      region,
      bucket,
      accessKeyId,
      secretAccessKey
    };
  }

  private getClient(config: ProductAssetConfig): S3Client {
    if (!this.client) {
      this.client = new S3Client({
        endpoint: config.endpoint,
        region: config.region,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey
        }
      });
    }

    return this.client;
  }

  private normalizeFilename(filename: string): string {
    const normalized = filename.trim();

    if (
      normalized.includes('..') ||
      normalized.includes('/') ||
      normalized.includes('\\') ||
      !PRODUCT_ASSET_FILENAME_PATTERN.test(normalized)
    ) {
      throw new BadRequestException('Invalid product asset filename');
    }

    return normalized;
  }

  async readProductAsset(filename: string): Promise<ProductAssetReadResult> {
    const normalizedFilename = this.normalizeFilename(filename);
    const config = this.readConfig();

    if (!config) {
      throw new ServiceUnavailableException('Product asset storage is not configured');
    }

    let output;
    try {
      output = await this.getClient(config).send(
        new GetObjectCommand({
          Bucket: config.bucket,
          Key: `${PRODUCT_ASSET_OBJECT_PREFIX}${normalizedFilename}`,
          Range: `bytes=0-${PRODUCT_ASSET_MAX_BYTES}`
        })
      );
    } catch (error) {
      const candidate = error as {
        name?: string;
        $metadata?: { httpStatusCode?: number };
      };

      if (
        candidate?.name === 'NoSuchKey' ||
        candidate?.name === 'NotFound' ||
        candidate?.$metadata?.httpStatusCode === 404
      ) {
        throw new NotFoundException('Product asset not found');
      }

      throw new ServiceUnavailableException('Product asset storage is temporarily unavailable');
    }

    if (!output.Body) {
      throw new NotFoundException('Product asset not found');
    }

    const contentType = output.ContentType?.trim().toLowerCase() || '';
    if (!contentType.startsWith('image/')) {
      throw new BadGatewayException('Stored product asset has an invalid content type');
    }

    const body = output.Body as {
      transformToByteArray?: () => Promise<Uint8Array>;
    };

    if (typeof body.transformToByteArray !== 'function') {
      throw new BadGatewayException('Stored product asset body is unreadable');
    }

    const bytes = await body.transformToByteArray();

    if (bytes.byteLength > PRODUCT_ASSET_MAX_BYTES) {
      throw new BadGatewayException('Stored product asset exceeds size limit');
    }

    return {
      body: Buffer.from(bytes),
      contentType,
      contentLength: bytes.byteLength,
      etag: output.ETag
    };
  }
}
