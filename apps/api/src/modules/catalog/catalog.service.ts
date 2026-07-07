import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Read-side catalog queries used by the bot. Admin CRUD lives in the admin controllers. */
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async activeCategories() {
    return this.prisma.productCategory.findMany({
      where: { isActive: true, products: { some: { isActive: true, variants: { some: { isActive: true } } } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async activeProducts(categoryId: string) {
    return this.prisma.product.findMany({
      where: { categoryId, isActive: true, variants: { some: { isActive: true } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async productWithVariants(productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, isActive: true },
      include: {
        category: true,
        variants: { where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async variantForPurchase(variantId: string) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, isActive: true, product: { isActive: true } },
      include: { product: { include: { category: true } } },
    });
    if (!variant) throw new NotFoundException('Plan not found');
    return variant;
  }

  /** Distinct option groups of a product's active variants, in sort order. */
  optionGroupsOf(variants: { optionGroup: string | null }[]): string[] {
    const groups: string[] = [];
    for (const v of variants) {
      if (v.optionGroup && !groups.includes(v.optionGroup)) groups.push(v.optionGroup);
    }
    return groups;
  }
}
