import { Controller, Get, Param, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import {
  PRODUCT_ASSET_CACHE_CONTROL,
  ProductAssetsService
} from './product-assets.service';

@Controller('assets/products')
export class ProductAssetsController {
  constructor(private readonly productAssets: ProductAssetsService) {}

  @Get(':filename')
  async getProductAsset(
    @Param('filename') filename: string,
    @Res({ passthrough: true }) response: Response
  ) {
    const asset = await this.productAssets.readProductAsset(filename);

    response.setHeader('Cache-Control', PRODUCT_ASSET_CACHE_CONTROL);
    response.setHeader('X-Content-Type-Options', 'nosniff');

    if (asset.etag) {
      response.setHeader('ETag', asset.etag);
    }

    return new StreamableFile(asset.body, {
      type: asset.contentType,
      length: asset.contentLength
    });
  }
}
