import {
  BadGatewayException,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ProductAssetsModule } from '../src/modules/product-assets/product-assets.module';
import { ProductAssetsService } from '../src/modules/product-assets/product-assets.service';

const ENV_KEYS = [
  'PRODUCT_ASSETS_S3_ENDPOINT',
  'PRODUCT_ASSETS_S3_REGION',
  'PRODUCT_ASSETS_S3_BUCKET',
  'PRODUCT_ASSETS_S3_ACCESS_KEY_ID',
  'PRODUCT_ASSETS_S3_SECRET_ACCESS_KEY'
] as const;

const ORIGINAL_ENV = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]])
);

function setConfiguredEnv() {
  process.env.PRODUCT_ASSETS_S3_ENDPOINT = 'https://bucket.example.invalid';
  process.env.PRODUCT_ASSETS_S3_REGION = 'sjc';
  process.env.PRODUCT_ASSETS_S3_BUCKET = 'product-assets';
  process.env.PRODUCT_ASSETS_S3_ACCESS_KEY_ID = 'test-access-key';
  process.env.PRODUCT_ASSETS_S3_SECRET_ACCESS_KEY = 'test-secret-key';
}

describe('ProductAssetsService', () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
  });

  afterAll(() => {
    for (const key of ENV_KEYS) {
      const value = ORIGINAL_ENV[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('fails closed when storage config is missing', async () => {
    const service = new ProductAssetsService();

    await expect(
      service.readProductAsset('product_dried_shrimp_cover.jpg')
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it.each([
    '../secret.jpg',
    '..%2Fsecret.jpg',
    'folder/secret.jpg',
    String.raw`folder\secret.jpg`,
    'not-an-image.txt'
  ])('rejects unsafe or unsupported filename: %s', async (filename) => {
    const service = new ProductAssetsService();

    await expect(
      service.readProductAsset(filename)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reads only the controlled products/dry object key', async () => {
    setConfiguredEnv();

    const send = jest.fn().mockResolvedValue({
      Body: {
        transformToByteArray: async () => new Uint8Array([1, 2, 3])
      },
      ContentType: 'image/jpeg',
      ContentLength: 3,
      ETag: '"etag-1"'
    });

    const service = new ProductAssetsService();
    (service as unknown as { client: { send: typeof send } }).client = { send };

    const result = await service.readProductAsset(
      'product_dried_shrimp_cover.jpg'
    );

    expect(send).toHaveBeenCalledTimes(1);

    const command = send.mock.calls[0][0];
    expect(command.input).toEqual({
      Bucket: 'product-assets',
      Key: 'products/dry/product_dried_shrimp_cover.jpg',
      Range: 'bytes=0-10485760'
    });

    expect(result).toEqual({
      body: Buffer.from([1, 2, 3]),
      contentType: 'image/jpeg',
      contentLength: 3,
      etag: '"etag-1"'
    });
  });

  it('rejects an object larger than the 10 MiB response cap', async () => {
    setConfiguredEnv();

    const oversized = new Uint8Array(10 * 1024 * 1024 + 1);
    const send = jest.fn().mockResolvedValue({
      Body: {
        transformToByteArray: async () => oversized
      },
      ContentType: 'image/jpeg'
    });

    const service = new ProductAssetsService();
    (service as unknown as { client: { send: typeof send } }).client = { send };

    await expect(
      service.readProductAsset('oversized.jpg')
    ).rejects.toThrow('Stored product asset exceeds size limit');
  });

  it('maps a missing object to 404', async () => {
    setConfiguredEnv();

    const send = jest.fn().mockRejectedValue({
      name: 'NoSuchKey',
      $metadata: { httpStatusCode: 404 }
    });

    const service = new ProductAssetsService();
    (service as unknown as { client: { send: typeof send } }).client = { send };

    await expect(
      service.readProductAsset('missing.jpg')
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a stored object with non-image Content-Type', async () => {
    setConfiguredEnv();

    const send = jest.fn().mockResolvedValue({
      Body: {
        transformToByteArray: async () => new Uint8Array([1, 2, 3])
      },
      ContentType: 'text/plain'
    });

    const service = new ProductAssetsService();
    (service as unknown as { client: { send: typeof send } }).client = { send };

    await expect(
      service.readProductAsset('wrong.jpg')
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('maps unexpected S3 failures to a generic 503', async () => {
    setConfiguredEnv();

    const send = jest.fn().mockRejectedValue(
      new Error('sensitive upstream detail')
    );

    const service = new ProductAssetsService();
    (service as unknown as { client: { send: typeof send } }).client = { send };

    await expect(
      service.readProductAsset('product.jpg')
    ).rejects.toThrow(
      'Product asset storage is temporarily unavailable'
    );
  });
});

describe('ProductAssetsModule', () => {
  it('wires the service without requiring storage config at startup', async () => {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }

    const moduleRef = await Test.createTestingModule({
      imports: [ProductAssetsModule]
    }).compile();

    expect(moduleRef.get(ProductAssetsService)).toBeInstanceOf(
      ProductAssetsService
    );

    await moduleRef.close();
  });
});
