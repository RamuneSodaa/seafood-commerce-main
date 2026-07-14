import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Cart, CartItem, Inventory, Product, Sku, SkuMemberPrice, Store } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { AddCartItemDto, ClearCartItemsDto, UpdateCartItemDto } from './dto/cart.dto';

type CartItemWithSku = CartItem & {
  sku: Sku & {
    product: Product;
    memberPrices: SkuMemberPrice[];
  };
};

type CartWithItems = Cart & {
  items: CartItemWithSku[];
};

type ActiveInventory = Inventory & {
  store: Store;
};

type StoreStock = {
  store: Store;
  availableStock: number;
};

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  private getCustomerId(userId?: string): string {
    const customerId = userId?.trim();

    if (!customerId) {
      throw new ForbiddenException('请先登录后再使用购物车。');
    }

    return customerId;
  }

  private async getOrCreateCart(customerId: string) {
    return this.prisma.cart.upsert({
      where: { customerId },
      update: {},
      create: { customerId }
    });
  }

  private async getCartWithItems(customerId: string): Promise<CartWithItems> {
    const cart = await this.getOrCreateCart(customerId);

    return this.prisma.cart.findUniqueOrThrow({
      where: { id: cart.id },
      include: {
        items: {
          include: {
            sku: {
              include: {
                product: true,
                memberPrices: {
                  where: { isActive: true, memberLevel: 'DEFAULT' },
                  take: 1
                }
              }
            }
          },
          orderBy: { updatedAt: 'desc' }
        }
      }
    });
  }

  private async getActiveStoreStocks(skuIds: string[]): Promise<Map<string, StoreStock[]>> {
    if (skuIds.length === 0) {
      return new Map();
    }

    const [inventories, availabilityRows] = await Promise.all([
      this.prisma.inventory.findMany({
        where: {
          skuId: { in: skuIds },
          store: { isActive: true }
        },
        include: { store: true }
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
    const bySku = new Map<string, StoreStock[]>();

    for (const inventory of inventories as ActiveInventory[]) {
      if (!enabledKeys.has(`${inventory.skuId}:${inventory.storeId}`)) {
        continue;
      }

      const current = bySku.get(inventory.skuId) || [];
      current.push({
        store: inventory.store,
        availableStock: Math.max(0, inventory.availableStock)
      });
      bySku.set(inventory.skuId, current);
    }

    return bySku;
  }

  private async assertSkuCanBeAdded(skuId: string, quantity: number) {
    const sku = await this.prisma.sku.findUnique({
      where: { id: skuId },
      include: { product: true }
    });

    if (!sku) {
      throw new BadRequestException('当前商品暂不可加入购物车。');
    }

    // Phase 2.48I：新鲜渔产受控白名单 —— internalTag=fresh_seafood_catalog 的商品即使 isPublished=false 也可加入（预订）。
    // 仍要求 SKU active + priceCents>0 + 下方库存/门店可售校验；其它未发布商品（含 product_master_cleaned 干货草稿）一律禁止。
    const isFreshPreorder = sku.product.internalTag === 'fresh_seafood_catalog';
    if (!isFreshPreorder && !sku.product.isPublished) {
      throw new BadRequestException('当前商品暂不可加入购物车。');
    }
    if (isFreshPreorder && sku.priceCents <= 0) {
      throw new BadRequestException('该鲜货暂未定价，暂不可预订。');
    }

    // Phase 2.38D：已停售(软禁用)规格不可加入购物车。
    if (!sku.isActive) {
      throw new BadRequestException('该规格已停售，请重新选择。');
    }

    const stockBySku = await this.getActiveStoreStocks([skuId]);
    const storeStocks = stockBySku.get(skuId) || [];
    const hasEnoughStock = storeStocks.some((row) => row.availableStock >= quantity);

    if (!hasEnoughStock) {
      throw new BadRequestException('当前规格库存不足。');
    }

    return sku;
  }

  private buildAvailableStores(cart: CartWithItems, stockBySku: Map<string, StoreStock[]>) {
    if (cart.items.length === 0) {
      return [];
    }

    const storeCandidates = new Map<string, { store: Store; passCount: number }>();

    for (const item of cart.items) {
      const stocks = stockBySku.get(item.skuId) || [];

      for (const stock of stocks) {
        if (stock.availableStock < item.quantity) {
          continue;
        }

        const current = storeCandidates.get(stock.store.id);
        storeCandidates.set(stock.store.id, {
          store: stock.store,
          passCount: (current?.passCount || 0) + 1
        });
      }
    }

    return [...storeCandidates.values()]
      .filter((candidate) => candidate.passCount === cart.items.length)
      .map((candidate) => ({
        id: candidate.store.id,
        name: candidate.store.name,
        address: candidate.store.address
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  }

  private async formatCart(cart: CartWithItems) {
    const skuIds = cart.items.map((item) => item.skuId);
    const stockBySku = await this.getActiveStoreStocks(skuIds);
    const items = cart.items.map((item) => {
      const storeStocks = stockBySku.get(item.skuId) || [];
      const availableStock = storeStocks.reduce((sum, row) => sum + row.availableStock, 0);
      const memberPriceCents = item.sku.memberPrices[0]?.priceCents ?? null;
      const unitPriceCents = memberPriceCents && memberPriceCents > 0
        ? Math.min(item.sku.priceCents, memberPriceCents)
        : item.sku.priceCents;

      return {
        id: item.id,
        skuId: item.skuId,
        quantity: item.quantity,
        availableStock,
        listUnitPriceCents: item.sku.priceCents,
        memberPriceCents,
        unitPriceCents,
        lineAmountCents: unitPriceCents * item.quantity,
        sku: {
          id: item.sku.id,
          code: item.sku.code,
          name: item.sku.name,
          priceCents: item.sku.priceCents,
          memberPriceCents
        },
        product: {
          id: item.sku.product.id,
          name: item.sku.product.name,
          description: item.sku.product.description,
          coverImageUrl: item.sku.product.coverImageUrl,
          category: item.sku.product.category,
          supportsPickup: item.sku.product.supportsPickup,
          supportsShipping: item.sku.product.supportsShipping,
          // Phase 2.48I：标记鲜鱼预订项，供前端显示“参考价/斤·以门店称重为准”，避免误读为固定结算价。
          isFreshPreorder: item.sku.product.internalTag === 'fresh_seafood_catalog'
        }
      };
    });

    return {
      id: cart.id,
      customerId: cart.customerId,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotalAmountCents: items.reduce((sum, item) => sum + item.lineAmountCents, 0),
      items,
      availableStores: this.buildAvailableStores(cart, stockBySku)
    };
  }

  async getCart(userId?: string) {
    const customerId = this.getCustomerId(userId);
    const cart = await this.getCartWithItems(customerId);

    return this.formatCart(cart);
  }

  async addItem(userId: string | undefined, dto: AddCartItemDto) {
    const customerId = this.getCustomerId(userId);
    const quantity = dto.quantity || 1;
    await this.assertSkuCanBeAdded(dto.skuId, quantity);

    const cart = await this.getOrCreateCart(customerId);

    // Phase 2.51D：鲜鱼已改为直购（普通订单/普通支付），与干货计价方式统一（均按 SKU 固定单价，鲜鱼单位为"斤"）。
    // 故放开 dry/fresh 混车保护 —— 允许干货与鲜鱼同处一个购物车、统一走普通 checkout/createOrder。
    // 旧 preorder 支付硬拦截仍按"旧 preorder 订单"判据保留（见 order-workflow isLegacyFreshPreorderOrder）。

    const existing = await this.prisma.cartItem.findUnique({
      where: {
        cartId_skuId: {
          cartId: cart.id,
          skuId: dto.skuId
        }
      }
    });
    const nextQuantity = (existing?.quantity || 0) + quantity;

    await this.assertSkuCanBeAdded(dto.skuId, nextQuantity);

    await this.prisma.cartItem.upsert({
      where: {
        cartId_skuId: {
          cartId: cart.id,
          skuId: dto.skuId
        }
      },
      update: {
        quantity: nextQuantity
      },
      create: {
        cartId: cart.id,
        skuId: dto.skuId,
        quantity
      }
    });

    return this.getCart(customerId);
  }

  async updateItem(userId: string | undefined, itemId: string, dto: UpdateCartItemDto) {
    const customerId = this.getCustomerId(userId);
    const cart = await this.getOrCreateCart(customerId);
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId }
    });

    if (!item || item.cartId !== cart.id) {
      throw new NotFoundException('购物车商品不存在。');
    }

    await this.assertSkuCanBeAdded(item.skuId, dto.quantity);

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: dto.quantity }
    });

    return this.getCart(customerId);
  }

  async removeItem(userId: string | undefined, itemId: string) {
    const customerId = this.getCustomerId(userId);
    const cart = await this.getOrCreateCart(customerId);
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId }
    });

    if (!item || item.cartId !== cart.id) {
      throw new NotFoundException('购物车商品不存在。');
    }

    await this.prisma.cartItem.delete({ where: { id: itemId } });

    return this.getCart(customerId);
  }

  async clearItems(userId: string | undefined, dto: ClearCartItemsDto) {
    const customerId = this.getCustomerId(userId);
    const cart = await this.getOrCreateCart(customerId);

    await this.prisma.cartItem.deleteMany({
      where: {
        cartId: cart.id,
        id: { in: dto.itemIds }
      }
    });

    return this.getCart(customerId);
  }
}
