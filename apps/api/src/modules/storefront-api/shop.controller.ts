import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { CatalogService } from '../catalog/catalog.service';
import { OrdersService, type Quote } from '../orders/orders.service';
import { DiscountsService } from '../discounts/discounts.service';
import { CustomerAuthGuard, CustomerRequest } from '../customer-auth/customer-auth.guard';

// Mirrors the bot's duration tabs (catalog.handler DURATION_MONTHS).
const DURATION_MONTHS = [1, 2, 3, 4];

const quoteSchema = z.object({
  variantId: z.string().min(1),
  months: z.number().int().min(1).max(12).optional(),
  code: z.string().trim().max(64).optional(),
});

@Controller('store')
@UseGuards(CustomerAuthGuard)
export class ShopController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly orders: OrdersService,
    private readonly discounts: DiscountsService,
  ) {}

  @Get('categories')
  categories() {
    return this.catalog.activeCategories();
  }

  @Get('categories/:id/products')
  products(@Param('id') id: string) {
    return this.catalog.activeProducts(id);
  }

  @Get('products/:id')
  async product(@Param('id') id: string) {
    const product = await this.catalog.productWithVariants(id);
    return {
      product: {
        id: product.id,
        title: product.title,
        description: product.description,
        categoryId: product.categoryId,
        useDurationTabs: product.useDurationTabs,
        durationExtraPercent: product.durationExtraPercent,
      },
      variants: product.variants.map((v) => ({
        id: v.id,
        title: v.title,
        price: v.price,
        optionGroup: v.optionGroup,
      })),
      optionGroups: this.catalog.optionGroupsOf(product.variants),
      durationMonths: DURATION_MONTHS,
    };
  }

  @Post('quote')
  async quote(@Req() req: CustomerRequest, @Body() body: unknown) {
    const { variantId, months, code } = quoteSchema.parse(body);
    return this.buildQuote(req.customer.id, variantId, months ?? 1, code);
  }

  @Post('checkout')
  async checkout(@Req() req: CustomerRequest, @Body() body: unknown) {
    const { variantId, months, code } = quoteSchema.parse(body);
    const quote = await this.buildQuote(req.customer.id, variantId, months ?? 1, code);
    const result = await this.orders.checkout(req.customer.id, quote);

    if (!result.ok) return result;
    return {
      ok: true as const,
      order: { number: result.order.number, total: result.order.total },
      fulfillment: result.fulfillment,
    };
  }

  /** Base quote + optional discount-code resolution (string → applied/rejected). */
  private async buildQuote(
    userId: string,
    variantId: string,
    months: number,
    code?: string,
  ): Promise<Quote> {
    const base = await this.orders.quote(userId, variantId, months);
    if (!code) return base;

    const validation = await this.discounts.validate(code, userId, base.subtotal);
    if (validation.ok) {
      return this.orders.quote(userId, variantId, months, validation.code.id);
    }
    return {
      ...base,
      discountStatus: 'rejected',
      discountReason: validation.reason,
      discountCodeText: code.trim().toUpperCase(),
    };
  }
}
