import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { AdminAuthGuard, AdminRequest, Roles } from '../admin-auth/admin-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const categorySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  emoji: z.string().optional(),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.coerce.boolean().default(true),
});

const productSchema = z.object({
  categoryId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  kind: z.enum(['account', 'config', 'license', 'gift_card', 'custom']).default('account'),
  useDurationTabs: z.coerce.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.coerce.boolean().default(true),
});

const variantSchema = z.object({
  productId: z.string().min(1),
  title: z.string().min(1),
  price: z.string().regex(/^\d+$/),
  fulfillmentMode: z.enum(['auto_inventory', 'manual_admin', 'hybrid_prefer_inventory']),
  optionGroup: z.string().optional(),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.coerce.boolean().default(true),
});

/**
 * Catalog CRUD. Deletes try a hard delete first; when historical relations
 * block it, the record (and its children) are deactivated so they disappear
 * from every list/select without corrupting order history.
 */
@UseGuards(AdminAuthGuard)
@Roles('catalog_manager')
@Controller('admin/catalog')
export class CatalogAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---------------- categories ----------------

  @Get('categories')
  async categories() {
    return this.prisma.productCategory.findMany({
      where: { isActive: true },
      include: { _count: { select: { products: { where: { isActive: true } } } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  @Post('categories')
  async createCategory(@Body() body: unknown, @Req() req: AdminRequest) {
    const data = categorySchema.parse(body);
    const created = await this.prisma.productCategory.create({ data });
    this.audit.log({ adminId: req.admin.id, action: 'catalog.category.create', entityType: 'ProductCategory', entityId: created.id });
    return created;
  }

  @Patch('categories/:id')
  async updateCategory(@Param('id') id: string, @Body() body: unknown, @Req() req: AdminRequest) {
    const data = categorySchema.partial().parse(body);
    const updated = await this.prisma.productCategory.update({ where: { id }, data });
    this.audit.log({ adminId: req.admin.id, action: 'catalog.category.update', entityType: 'ProductCategory', entityId: id });
    return updated;
  }

  @Delete('categories/:id')
  async deleteCategory(@Param('id') id: string, @Req() req: AdminRequest) {
    try {
      await this.prisma.$transaction(async (tx) => {
        const products = await tx.product.findMany({ where: { categoryId: id }, select: { id: true } });
        const productIds = products.map((p) => p.id);
        await tx.inventoryItem.deleteMany({ where: { variant: { productId: { in: productIds } }, status: 'available' } });
        await tx.productVariant.deleteMany({ where: { productId: { in: productIds } } });
        await tx.productOption.deleteMany({ where: { productId: { in: productIds } } });
        await tx.product.deleteMany({ where: { categoryId: id } });
        await tx.productCategory.delete({ where: { id } });
      });
      this.audit.log({ adminId: req.admin.id, action: 'catalog.category.delete', entityType: 'ProductCategory', entityId: id });
      return { deleted: true, mode: 'hard' };
    } catch {
      await this.prisma.$transaction([
        this.prisma.productCategory.update({ where: { id }, data: { isActive: false } }),
        this.prisma.product.updateMany({ where: { categoryId: id }, data: { isActive: false } }),
        this.prisma.productVariant.updateMany({ where: { product: { categoryId: id } }, data: { isActive: false } }),
      ]);
      this.audit.log({ adminId: req.admin.id, action: 'catalog.category.deactivate', entityType: 'ProductCategory', entityId: id });
      return { deleted: true, mode: 'deactivated' };
    }
  }

  // ---------------- products ----------------

  @Get('products')
  async products() {
    return this.prisma.product.findMany({
      where: { isActive: true },
      include: {
        category: true,
        _count: { select: { variants: { where: { isActive: true } } } },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  @Post('products')
  async createProduct(@Body() body: unknown, @Req() req: AdminRequest) {
    const data = productSchema.parse(body);
    const category = await this.prisma.productCategory.findFirst({ where: { id: data.categoryId, isActive: true } });
    if (!category) throw new NotFoundException('Category not found');
    const created = await this.prisma.product.create({ data });
    this.audit.log({ adminId: req.admin.id, action: 'catalog.product.create', entityType: 'Product', entityId: created.id });
    return created;
  }

  @Patch('products/:id')
  async updateProduct(@Param('id') id: string, @Body() body: unknown, @Req() req: AdminRequest) {
    const data = productSchema.partial().parse(body);
    const updated = await this.prisma.product.update({ where: { id }, data });
    this.audit.log({ adminId: req.admin.id, action: 'catalog.product.update', entityType: 'Product', entityId: id });
    return updated;
  }

  @Delete('products/:id')
  async deleteProduct(@Param('id') id: string, @Req() req: AdminRequest) {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.inventoryItem.deleteMany({ where: { variant: { productId: id }, status: 'available' } });
        await tx.productVariant.deleteMany({ where: { productId: id } });
        await tx.productOption.deleteMany({ where: { productId: id } });
        await tx.product.delete({ where: { id } });
      });
      this.audit.log({ adminId: req.admin.id, action: 'catalog.product.delete', entityType: 'Product', entityId: id });
      return { deleted: true, mode: 'hard' };
    } catch {
      await this.prisma.$transaction([
        this.prisma.product.update({ where: { id }, data: { isActive: false } }),
        this.prisma.productVariant.updateMany({ where: { productId: id }, data: { isActive: false } }),
      ]);
      this.audit.log({ adminId: req.admin.id, action: 'catalog.product.deactivate', entityType: 'Product', entityId: id });
      return { deleted: true, mode: 'deactivated' };
    }
  }

  // ---------------- variants (plans) ----------------

  @Get('variants')
  async variants() {
    const variants = await this.prisma.productVariant.findMany({
      where: { isActive: true },
      include: {
        product: { include: { category: true } },
        _count: { select: { orderItems: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    // Per-status inventory breakdown (available is the sellable number).
    const grouped = await this.prisma.inventoryItem.groupBy({
      by: ['variantId', 'status'],
      _count: { _all: true },
    });
    const inventoryByVariant: Record<string, Record<string, number>> = {};
    for (const g of grouped) {
      (inventoryByVariant[g.variantId] ??= {})[g.status] = g._count._all;
    }
    return variants.map((v) => ({ ...v, inventory: inventoryByVariant[v.id] ?? {} }));
  }

  @Post('variants')
  async createVariant(@Body() body: unknown, @Req() req: AdminRequest) {
    const data = variantSchema.parse(body);
    const product = await this.prisma.product.findFirst({ where: { id: data.productId, isActive: true } });
    if (!product) throw new NotFoundException('Product not found');
    const created = await this.prisma.productVariant.create({
      data: { ...data, price: BigInt(data.price), optionGroup: data.optionGroup?.trim() || null },
    });
    this.audit.log({ adminId: req.admin.id, action: 'catalog.variant.create', entityType: 'ProductVariant', entityId: created.id });
    return created;
  }

  @Patch('variants/:id')
  async updateVariant(@Param('id') id: string, @Body() body: unknown, @Req() req: AdminRequest) {
    const data = variantSchema.partial().parse(body);
    const updated = await this.prisma.productVariant.update({
      where: { id },
      data: {
        ...data,
        price: data.price != null ? BigInt(data.price) : undefined,
        optionGroup: data.optionGroup !== undefined ? data.optionGroup.trim() || null : undefined,
      },
    });
    this.audit.log({ adminId: req.admin.id, action: 'catalog.variant.update', entityType: 'ProductVariant', entityId: id });
    return updated;
  }

  @Delete('variants/:id')
  async deleteVariant(@Param('id') id: string, @Req() req: AdminRequest) {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.inventoryItem.deleteMany({ where: { variantId: id, status: 'available' } });
        await tx.productVariant.delete({ where: { id } });
      });
      this.audit.log({ adminId: req.admin.id, action: 'catalog.variant.delete', entityType: 'ProductVariant', entityId: id });
      return { deleted: true, mode: 'hard' };
    } catch {
      await this.prisma.productVariant.update({ where: { id }, data: { isActive: false } });
      this.audit.log({ adminId: req.admin.id, action: 'catalog.variant.deactivate', entityType: 'ProductVariant', entityId: id });
      return { deleted: true, mode: 'deactivated' };
    }
  }
}
