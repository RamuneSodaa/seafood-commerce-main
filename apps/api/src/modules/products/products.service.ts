import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { CreateDraftProductDto, CreateProductDto, CreateSkuDto, UpdateProductDto, UpdateSkuDto } from './dto/product.dto';
import { assertProductCanBePublished } from './product-publish-guard';

// Phase 2.45B：价格未定草稿商品的内部标签常量（后端强制，不接受客户端覆盖）。
const PRICE_PENDING_TAG = 'price_pending';

// Phase 2.48C：新鲜渔产目录内部标签（双频道短期过渡，不改 schema）。
const FRESH_SEAFOOD_TAG = 'fresh_seafood_catalog';

type AuditEntry = {
  adminId?: string;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel?: string | null;
  summary?: string | null;
  metadata?: Record<string, string | number | boolean | null | undefined>;
};

type PublishedProductFilters = {
  category?: string;
  q?: string;
};

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildDefaultSkuCode(productId: string) {
    return `DEFAULT-${productId.toUpperCase()}`;
  }

  // Phase 2.42B：审计 metadata 净化（剔除 undefined、长文本截断）。严禁密码/token/secret/顾客 PII。
  private buildAuditMetadataJson(metadata?: Record<string, string | number | boolean | null | undefined>): string | undefined {
    if (!metadata) return undefined;
    const clean: Record<string, string | number | boolean | null> = {};
    for (const [k, v] of Object.entries(metadata)) {
      if (v === undefined) continue;
      clean[k] = typeof v === 'string' && v.length > 200 ? `${v.slice(0, 200)}…` : v;
    }
    return JSON.stringify(clean);
  }

  // Phase 2.42B：在【同一事务】内写审计日志。失败会抛出 → 业务一并回滚（强一致，不再 best-effort）。
  private async recordAuditTx(tx: Prisma.TransactionClient, entry: AuditEntry) {
    await tx.adminAuditLog.create({
      data: {
        adminId: entry.adminId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        entityLabel: entry.entityLabel ?? undefined,
        summary: entry.summary ?? undefined,
        metadataJson: this.buildAuditMetadataJson(entry.metadata)
      }
    });
  }

  private formatYuan(priceCents: number): string {
    return `¥${((priceCents || 0) / 100).toFixed(2)}`;
  }

  // Phase 2.42A：审计日志查询（ADMIN）。
  async listAuditLogs(filters: { limit?: number; entityType?: string; entityId?: string; action?: string } = {}) {
    const take = Math.min(Math.max(Number(filters.limit) || 100, 1), 500);
    return this.prisma.adminAuditLog.findMany({
      where: {
        ...(filters.entityType ? { entityType: filters.entityType } : {}),
        ...(filters.entityId ? { entityId: filters.entityId } : {}),
        ...(filters.action ? { action: filters.action } : {})
      },
      orderBy: { createdAt: 'desc' },
      take,
      include: { admin: { select: { id: true, username: true, displayName: true } } }
    });
  }

  private async attachSkuAvailableStock<T extends { skus: Array<{ id: string }> }>(products: T[]): Promise<T[]> {
    const skuIds = products.flatMap((product) => product.skus.map((sku) => sku.id));

    if (skuIds.length === 0) {
      return products;
    }

    const [inventories, availabilityRows] = await Promise.all([
      this.prisma.inventory.findMany({
        where: {
          skuId: { in: skuIds },
          store: { isActive: true }
        },
        select: {
          skuId: true,
          storeId: true,
          availableStock: true
        }
      }),
      this.prisma.storeSkuAvailability.findMany({
        where: {
          skuId: { in: skuIds },
          isEnabled: true,
          store: { isActive: true }
        },
        select: {
          skuId: true,
          storeId: true
        }
      })
    ]);

    const enabledKeys = new Set(availabilityRows.map((row) => `${row.skuId}:${row.storeId}`));
    const stockBySku = new Map<string, number>();

    for (const inventory of inventories) {
      if (!enabledKeys.has(`${inventory.skuId}:${inventory.storeId}`)) {
        continue;
      }

      stockBySku.set(inventory.skuId, (stockBySku.get(inventory.skuId) || 0) + Math.max(0, inventory.availableStock));
    }

    return products.map((product) => ({
      ...product,
      skus: product.skus.map((sku) => ({
        ...sku,
        availableStock: stockBySku.get(sku.id) || 0
      }))
    }));
  }

  private normalizeStorefrontProduct<T extends { skus: Array<Record<string, unknown>> }>(product: T) {
    return {
      ...product,
      skus: product.skus.map((sku) => {
        const memberPrices = Array.isArray(sku.memberPrices) ? sku.memberPrices as Array<{ priceCents?: number }> : [];
        const { memberPrices: _memberPrices, ...rest } = sku;

        return {
          ...rest,
          memberPriceCents: memberPrices[0]?.priceCents ?? null
        };
      })
    };
  }

  list() {
    return this.prisma.product.findMany({ include: { skus: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] });
  }

  async listPublished(filters: PublishedProductFilters = {}) {
    const category = filters.category?.trim();
    const q = filters.q?.trim();
    const isRecommendedFilter = category === '今日推荐';

    const products = await this.prisma.product.findMany({
      where: {
        isPublished: true,
        // Phase 2.48C：新鲜渔产目录(fresh_seafood_catalog)均为 isPublished=false 且无 active SKU，
        // 下面的 isPublished + active-SKU 过滤已天然排除它们，干货频道不会混入鲜鱼。
        // 注意：不要用 NOT:{internalTag:FRESH} —— 对 internalTag 为 NULL 的 seed 商品会被 SQL 的 NULL 语义误排除。
        // Phase 2.38E：顾客端只返回至少有 1 个启用(active) SKU 的商品，避免出现 skus=[] 的空规格商品卡。
        skus: { some: { isActive: true } },
        ...(isRecommendedFilter ? { isRecommended: true } : {}),
        ...(category && category !== '全部' && !isRecommendedFilter ? { category } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
                { skus: { some: { name: { contains: q, mode: 'insensitive' } } } }
              ]
            }
          : {})
      },
      select: {
        id: true,
        name: true,
        description: true,
        coverImageUrl: true,
        category: true,
        sortOrder: true,
        isRecommended: true,
        supportsPickup: true,
        supportsShipping: true,
        skus: {
          where: { isActive: true },
          select: {
            id: true,
            code: true,
            name: true,
            priceCents: true,
            memberPrices: {
              where: { isActive: true, memberLevel: 'DEFAULT' },
              select: { priceCents: true },
              take: 1
            }
          }
        }
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }]
    });

    const productsWithStock = await this.attachSkuAvailableStock(products);
    return productsWithStock.map((product) => this.normalizeStorefrontProduct(product));
  }

  // Phase 2.48C：新鲜渔产目录（channel=fresh）。只读、不改 schema、不依赖 isPublished。
  // 安全约束：不返回可售价格（priceCents=0 仅作占位，前端不显示 0 元），派生"时价/联系确认/不可加购"字段，
  // 绝不进入普通加购/支付流程。
  async listFreshCatalog() {
    const products = await this.prisma.product.findMany({
      where: { internalTag: FRESH_SEAFOOD_TAG },
      select: {
        id: true,
        name: true,
        description: true,
        coverImageUrl: true,
        category: true,
        sortOrder: true,
        internalNote: true,
        skus: { select: { id: true, priceCents: true, isActive: true }, take: 1 }
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }]
    });

    return products.map((product) => {
      let displayPriceLabel = '时价';
      let suggestedDisplayTag = '每日到货/时价';
      let unit = '斤';
      let hasReferencePrice = false;
      try {
        const note = product.internalNote ? JSON.parse(product.internalNote) : {};
        if (typeof note.priceLabel === 'string' && note.priceLabel) displayPriceLabel = note.priceLabel;
        if (typeof note.suggestedDisplayTag === 'string' && note.suggestedDisplayTag) suggestedDisplayTag = note.suggestedDisplayTag;
        if (typeof note.unit === 'string' && note.unit) unit = note.unit;
        if (note.testReferencePrice === true) hasReferencePrice = true;
      } catch {
        // internalNote 非 JSON 时使用默认值
      }
      const sku = product.skus[0];
      const refCents = sku && sku.priceCents > 0 ? sku.priceCents : null;
      const referencePriceLabel = refCents != null
        ? `参考价 ¥${(refCents / 100).toFixed(0)}/${unit}`
        : null;
      return {
        id: product.id,
        skuId: sku?.id ?? null,
        name: product.name,
        description: product.description,
        coverImageUrl: product.coverImageUrl,
        category: product.category,
        channel: 'fresh',
        businessLine: 'FRESH_SEAFOOD',
        priceMode: hasReferencePrice ? 'REFERENCE_MARKET_PRICE' : 'MARKET_PRICE',
        displayPriceLabel,                  // 时价
        suggestedDisplayTag,                // 每日到货/时价
        unit,                               // 斤
        referencePriceCents: refCents,      // 测试参考价（分）；仅展示，非最终价
        referencePriceLabel,                // 参考价 ¥48/斤
        saleHint: '实际价格以门店称重确认为准',
        // Phase 2.48I：受控预订 —— 购物车已对 fresh_seafood_catalog 放行（仍 isPublished=false、不进 /products）。
        // 仅当已设参考价时允许预订加购。
        orderMode: 'FRESH_PREORDER',
        canAddToCart: refCents != null,
        priceCents: null                    // 不暴露为普通可售价
      };
    });
  }

  async getPublishedDetail(id: string) {
    const product = await this.prisma.product.findFirst({
      // Phase 2.38E：详情同样要求至少 1 个启用 SKU；全部停售的已发布商品对顾客视为不存在（404）。
      where: { id, isPublished: true, skus: { some: { isActive: true } } },
      select: {
        id: true,
        name: true,
        description: true,
        coverImageUrl: true,
        category: true,
        // Phase 2.49L-a：透出 internalTag，供前台判定 fresh 并选用 fresh 占位图（不改 DB、不改筛选）。
        internalTag: true,
        sortOrder: true,
        isRecommended: true,
        supportsPickup: true,
        supportsShipping: true,
        skus: {
          where: { isActive: true },
          select: {
            id: true,
            code: true,
            name: true,
            priceCents: true,
            memberPrices: {
              where: { isActive: true, memberLevel: 'DEFAULT' },
              select: { priceCents: true },
              take: 1
            }
          }
        }
      }
    });

    if (!product) throw new NotFoundException('Published product not found');
    const [productWithStock] = await this.attachSkuAvailableStock([product]);
    return this.normalizeStorefrontProduct(productWithStock);
  }

  create(dto: CreateProductDto, actorAdminId?: string) {
    return this.prisma.$transaction(async (tx) => {
      if (!dto.supportsPickup && !dto.supportsShipping) {
        throw new BadRequestException('Product must support at least one fulfillment type');
      }

      const store = await tx.store.findUnique({
        where: { id: dto.initialStoreId }
      });

      if (!store) {
        throw new BadRequestException('Initial store not found');
      }

      const product = await tx.product.create({
        data: {
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          coverImageUrl: dto.coverImageUrl?.trim() || null,
          category: dto.category?.trim() || null,
          supportsPickup: dto.supportsPickup,
          supportsShipping: dto.supportsShipping
        }
      });

      const defaultSkuCode = dto.defaultSkuCode?.trim() || this.buildDefaultSkuCode(product.id);

      const sku = await tx.sku.create({
        data: {
          productId: product.id,
          code: defaultSkuCode,
          name: dto.defaultSkuName.trim(),
          priceCents: dto.defaultPriceCents
        }
      });

      await tx.inventory.create({
        data: {
          storeId: dto.initialStoreId,
          skuId: sku.id,
          physicalStock: dto.initialStock,
          availableStock: dto.initialStock,
          reservedStock: 0
        }
      });

      await tx.storeSkuAvailability.create({
        data: {
          storeId: dto.initialStoreId,
          skuId: sku.id,
          isEnabled: true
        }
      });

      // Phase 2.45B：补齐普通建商品审计缺口。与建档同事务（失败则整单回滚）。
      await this.recordAuditTx(tx, {
        adminId: actorAdminId,
        action: 'product.create',
        entityType: 'product',
        entityId: product.id,
        entityLabel: product.name,
        summary: `创建可售商品（默认规格 ${sku.name}，${this.formatYuan(sku.priceCents)}）`,
        metadata: { defaultSkuName: sku.name, priceCents: sku.priceCents, initialStock: dto.initialStock, category: product.category ?? null }
      });

      return tx.product.findUniqueOrThrow({
        where: { id: product.id },
        include: { skus: true }
      });
    });
  }

  // Phase 2.45B：价格未定草稿商品建档。只创建未发布 Product，不建 SKU/库存/可售关系，
  // 用 internalTag=price_pending 标记。价格未定 = SKU 缺席（绝不写占位价）。
  // 顾客端 listPublished/getPublishedDetail 要求 isPublished+至少 1 个 active SKU，
  // 加购/下单要求 isPublished+isActive，故无 SKU 的未发布草稿天然不可见、不可购买。
  createDraft(dto: CreateDraftProductDto, actorAdminId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const internalNote = dto.internalNote?.trim() || null;
      const product = await tx.product.create({
        data: {
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          coverImageUrl: dto.coverImageUrl?.trim() || null,
          category: dto.category?.trim() || null,
          // 价格未定草稿强制未发布；internalTag 后端强制，不接受客户端覆盖。
          isPublished: false,
          internalTag: PRICE_PENDING_TAG,
          internalNote
        }
      });

      await this.recordAuditTx(tx, {
        adminId: actorAdminId,
        action: 'product.create_draft',
        entityType: 'product',
        entityId: product.id,
        entityLabel: product.name,
        summary: '创建价格未定草稿商品',
        // 仅记录非敏感字段是否有值，不落顾客 PII / secret。
        metadata: {
          name: product.name,
          category: product.category ?? null,
          internalTag: PRICE_PENDING_TAG,
          hasInternalNote: Boolean(internalNote),
          hasDescription: Boolean(product.description),
          hasCoverImage: Boolean(product.coverImageUrl)
        }
      });

      return tx.product.findUniqueOrThrow({
        where: { id: product.id },
        include: { skus: true }
      });
    });
  }

  async update(id: string, dto: UpdateProductDto, actorAdminId?: string) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const exists = await tx.product.findUnique({
        where: { id },
        include: { skus: true }
      });

      if (!exists) throw new NotFoundException('Product not found');

      const nextSupportsPickup = dto.supportsPickup ?? exists.supportsPickup;
      const nextSupportsShipping = dto.supportsShipping ?? exists.supportsShipping;

      if (!nextSupportsPickup && !nextSupportsShipping) {
        throw new BadRequestException('Product must support at least one fulfillment type');
      }

      const shouldUpdateDefaultSku = dto.defaultSkuName !== undefined || dto.defaultPriceCents !== undefined;

      if (shouldUpdateDefaultSku && exists.skus.length !== 1) {
        throw new BadRequestException('Current minimal edit only supports single-SKU products');
      }

      await tx.product.update({
        where: { id },
        data: {
          name: dto.name?.trim() || dto.name,
          description: dto.description?.trim() || dto.description,
          coverImageUrl: dto.coverImageUrl?.trim() || dto.coverImageUrl,
          category: dto.category?.trim() || dto.category,
          supportsPickup: dto.supportsPickup,
          supportsShipping: dto.supportsShipping,
          // Phase 2.39C：内部标签/备注（仅当传入时更新，不影响顾客端/发布状态）。
          internalTag: dto.internalTag !== undefined ? dto.internalTag : exists.internalTag,
          internalNote: dto.internalNote !== undefined ? dto.internalNote : exists.internalNote
        }
      });

      if (shouldUpdateDefaultSku) {
        await tx.sku.update({
          where: { id: exists.skus[0].id },
          data: {
            name: dto.defaultSkuName?.trim() || dto.defaultSkuName,
            priceCents: dto.defaultPriceCents
          }
        });
      }

      // Phase 2.42A：计算变更字段摘要（仅非敏感商品级字段；长文本由 recordAudit 截断）。
      const changed: Record<string, string | number | boolean | null> = {};
      const fields: Array<keyof UpdateProductDto> = ['name', 'description', 'coverImageUrl', 'category', 'supportsPickup', 'supportsShipping', 'internalTag', 'internalNote'];
      for (const f of fields) {
        if (dto[f] === undefined) continue;
        const before = (exists as Record<string, unknown>)[f];
        const after = dto[f] as unknown;
        if (before !== after) {
          changed[`${f}_old`] = (before as string | number | boolean | null) ?? null;
          changed[`${f}_new`] = (after as string | number | boolean | null) ?? null;
        }
      }

      // Phase 2.42B：仅当有实际变更时，在同一事务内写审计日志（失败则整单回滚）。
      if (Object.keys(changed).length > 0) {
        await this.recordAuditTx(tx, {
          adminId: actorAdminId,
          action: 'product.update',
          entityType: 'product',
          entityId: id,
          entityLabel: exists.name,
          summary: '修改商品基础信息',
          metadata: changed
        });
      }

      return tx.product.findUniqueOrThrow({
        where: { id },
        include: { skus: true }
      });
    });

    return updated;
  }

  async publish(id: string, actorAdminId?: string) {
    const exists = await this.prisma.product.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Product not found');

    // Phase 2.47A-23：防误发布硬保护。阻止 1 元价格占位 / 缺图 / 零价 / 鲜鱼 / legacy seed3 等被发布。
    const guardTarget = await this.prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        category: true,
        internalTag: true,
        coverImageUrl: true,
        internalNote: true,
        skus: { select: { priceCents: true, isActive: true } }
      }
    });
    if (guardTarget) {
      assertProductCanBePublished(guardTarget, (msg) => new BadRequestException(msg));
    }

    const [skuCount, inventoryCount, availabilityCount] = await Promise.all([
      // Phase 2.38D：发布需至少 1 个启用(active) SKU，避免发布无可售规格的商品。
      this.prisma.sku.count({
        where: { productId: id, isActive: true }
      }),
      this.prisma.inventory.count({
        where: {
          sku: {
            productId: id
          }
        }
      }),
      this.prisma.storeSkuAvailability.count({
        where: {
          isEnabled: true,
          sku: {
            productId: id
          }
        }
      })
    ]);

    if (skuCount === 0) {
      throw new BadRequestException('Product requires at least one active SKU before publish');
    }

    if (inventoryCount === 0) {
      throw new BadRequestException('Product requires inventory before publish');
    }

    if (availabilityCount === 0) {
      throw new BadRequestException('Product requires enabled store availability before publish');
    }

    // Phase 2.42B：发布与审计同事务。
    return this.prisma.$transaction(async (tx) => {
      const published = await tx.product.update({ where: { id }, data: { isPublished: true } });
      await this.recordAuditTx(tx, {
        adminId: actorAdminId,
        action: 'product.publish',
        entityType: 'product',
        entityId: id,
        entityLabel: exists.name,
        summary: '发布商品'
      });
      return published;
    });
  }

  // Phase 2.38C：后台软下架（取消发布）。仅置 isPublished=false，不硬删商品/SKU，历史订单不受影响。幂等。
  async unpublish(id: string, actorAdminId?: string) {
    const exists = await this.prisma.product.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Product not found');
    // Phase 2.42B：下架与审计同事务。幂等场景（已未发布）summary 标记“重复下架（已是未发布）”。
    const alreadyUnpublished = !exists.isPublished;
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.product.update({ where: { id }, data: { isPublished: false } });
      await this.recordAuditTx(tx, {
        adminId: actorAdminId,
        action: 'product.unpublish',
        entityType: 'product',
        entityId: id,
        entityLabel: exists.name,
        summary: alreadyUnpublished ? '下架商品（重复下架，已是未发布）' : '下架商品'
      });
      return result;
    });
  }

  // Phase 2.38C：后台为已有商品新增 SKU（多规格管理）。
  // 不硬删；新 SKU 默认初始库存 0，并在该商品现有 SKU 已铺货的门店上建立可售关系，保持一致。
  async addSku(productId: string, dto: CreateSkuDto, actorAdminId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        include: { skus: true }
      });
      if (!product) throw new NotFoundException('Product not found');

      const requestedCode = dto.code?.trim();
      const code = requestedCode || `SKU-${productId.toUpperCase()}-${Date.now()}`;

      const codeOwner = await tx.sku.findUnique({ where: { code } });
      if (codeOwner) throw new BadRequestException('SKU code already exists');

      const sku = await tx.sku.create({
        data: {
          productId,
          code,
          name: dto.name.trim(),
          priceCents: dto.priceCents
        }
      });

      // 找到该商品现有 SKU 已建立可售关系的门店集合，给新 SKU 建库存(0)+可售关系，保持与兄弟 SKU 一致。
      const siblingSkuIds = product.skus.map((s) => s.id);
      if (siblingSkuIds.length > 0) {
        const availabilities = await tx.storeSkuAvailability.findMany({
          where: { skuId: { in: siblingSkuIds } },
          select: { storeId: true }
        });
        const storeIds = Array.from(new Set(availabilities.map((a) => a.storeId)));

        for (const storeId of storeIds) {
          await tx.inventory.upsert({
            where: { storeId_skuId: { storeId, skuId: sku.id } },
            update: {},
            create: {
              storeId,
              skuId: sku.id,
              physicalStock: 0,
              availableStock: 0,
              reservedStock: 0
            }
          });
          await tx.storeSkuAvailability.upsert({
            where: { storeId_skuId: { storeId, skuId: sku.id } },
            update: { isEnabled: true },
            create: { storeId, skuId: sku.id, isEnabled: true }
          });
        }
      }

      // Phase 2.42B：新增 SKU 与审计同事务。
      await this.recordAuditTx(tx, {
        adminId: actorAdminId,
        action: 'sku.create',
        entityType: 'sku',
        entityId: sku.id,
        entityLabel: sku.name,
        summary: `新增规格：${sku.name}（${this.formatYuan(sku.priceCents)}）`,
        metadata: { productId, skuName: sku.name, priceCents: sku.priceCents, isActive: true }
      });

      return tx.product.findUniqueOrThrow({ where: { id: productId }, include: { skus: true } });
    });
  }

  // Phase 2.38C：后台编辑单个 SKU 的名称/价格（支持多 SKU 商品，不受单 SKU 限制）。
  async updateSku(skuId: string, dto: UpdateSkuDto, actorAdminId?: string) {
    // Phase 2.42B：SKU 编辑与审计同事务（强一致）。无实际变更则不写审计。
    return this.prisma.$transaction(async (tx) => {
      const sku = await tx.sku.findUnique({ where: { id: skuId } });
      if (!sku) throw new NotFoundException('SKU not found');

      const nextName = dto.name?.trim() || sku.name;
      const nextPrice = dto.priceCents ?? sku.priceCents;
      const nextActive = dto.isActive ?? sku.isActive;

      await tx.sku.update({
        where: { id: skuId },
        data: {
          name: nextName,
          priceCents: nextPrice,
          // Phase 2.38D：软禁用/启用（停售/恢复规格）。不删除记录，历史订单不受影响。
          isActive: nextActive
        }
      });

      const parts: string[] = [];
      const metadata: Record<string, string | number | boolean> = { skuId };
      if (nextName !== sku.name) { parts.push(`规格名称：${sku.name} → ${nextName}`); metadata.name_old = sku.name; metadata.name_new = nextName; }
      if (nextPrice !== sku.priceCents) { parts.push(`价格：${this.formatYuan(sku.priceCents)} → ${this.formatYuan(nextPrice)}`); metadata.priceCents_old = sku.priceCents; metadata.priceCents_new = nextPrice; }
      if (nextActive !== sku.isActive) { parts.push(nextActive ? '启用规格' : '停售规格'); metadata.isActive_old = sku.isActive; metadata.isActive_new = nextActive; }
      if (parts.length > 0) {
        await this.recordAuditTx(tx, {
          adminId: actorAdminId,
          action: 'sku.update',
          entityType: 'sku',
          entityId: skuId,
          entityLabel: nextName,
          summary: parts.join('；'),
          metadata
        });
      }

      return tx.product.findUniqueOrThrow({
        where: { id: sku.productId },
        include: { skus: true }
      });
    });
  }
}
