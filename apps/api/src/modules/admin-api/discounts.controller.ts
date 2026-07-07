import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AdminAuthGuard, AdminRequest, Roles } from '../admin-auth/admin-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const discountSchema = z.object({
  code: z.string().min(2).transform((s) => s.trim().toUpperCase()),
  type: z.enum(['percent', 'fixed']),
  value: z.string().regex(/^\d+$/),
  maxUses: z.coerce.number().int().positive().nullish(),
  maxUsesPerUser: z.coerce.number().int().positive().nullish(),
  minOrderTotal: z.string().regex(/^\d+$/).nullish(),
  expiresAt: z.string().datetime().nullish(),
  isActive: z.coerce.boolean().default(true),
});

@UseGuards(AdminAuthGuard)
@Roles('catalog_manager')
@Controller('admin/discounts')
export class DiscountsAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list() {
    return this.prisma.discountCode.findMany({
      include: { _count: { select: { redemptions: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post()
  async create(@Body() body: unknown, @Req() req: AdminRequest) {
    const data = discountSchema.parse(body);
    const created = await this.prisma.discountCode.create({
      data: {
        code: data.code,
        type: data.type,
        value: BigInt(data.value),
        maxUses: data.maxUses ?? null,
        maxUsesPerUser: data.maxUsesPerUser ?? null,
        minOrderTotal: data.minOrderTotal ? BigInt(data.minOrderTotal) : null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        isActive: data.isActive,
      },
    });
    this.audit.log({ adminId: req.admin.id, action: 'discount.create', entityType: 'DiscountCode', entityId: created.id });
    return created;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: unknown, @Req() req: AdminRequest) {
    const data = discountSchema.partial().parse(body);
    const updated = await this.prisma.discountCode.update({
      where: { id },
      data: {
        ...('code' in data && data.code ? { code: data.code } : {}),
        ...('type' in data && data.type ? { type: data.type } : {}),
        ...('value' in data && data.value ? { value: BigInt(data.value) } : {}),
        ...('maxUses' in data ? { maxUses: data.maxUses ?? null } : {}),
        ...('maxUsesPerUser' in data ? { maxUsesPerUser: data.maxUsesPerUser ?? null } : {}),
        ...('minOrderTotal' in data
          ? { minOrderTotal: data.minOrderTotal ? BigInt(data.minOrderTotal) : null }
          : {}),
        ...('expiresAt' in data ? { expiresAt: data.expiresAt ? new Date(data.expiresAt) : null } : {}),
        ...('isActive' in data ? { isActive: data.isActive } : {}),
      },
    });
    this.audit.log({ adminId: req.admin.id, action: 'discount.update', entityType: 'DiscountCode', entityId: id });
    return updated;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: AdminRequest) {
    try {
      await this.prisma.discountCode.delete({ where: { id } });
      this.audit.log({ adminId: req.admin.id, action: 'discount.delete', entityType: 'DiscountCode', entityId: id });
      return { deleted: true, mode: 'hard' };
    } catch {
      await this.prisma.discountCode.update({ where: { id }, data: { isActive: false } });
      this.audit.log({ adminId: req.admin.id, action: 'discount.deactivate', entityType: 'DiscountCode', entityId: id });
      return { deleted: true, mode: 'deactivated' };
    }
  }
}
