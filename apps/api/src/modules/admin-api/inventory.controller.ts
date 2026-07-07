import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { AdminAuthGuard, AdminRequest, Roles } from '../admin-auth/admin-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from '../fulfillment/inventory.service';
import { AuditService } from '../audit/audit.service';

const createSchema = z.object({
  variantId: z.string().min(1),
  label: z.string().min(1),
  /** Plaintext credentials/config — encrypted before storage, never logged. */
  payload: z.string().min(1),
});

@UseGuards(AdminAuthGuard)
@Roles('catalog_manager', 'operator')
@Controller('admin/inventory')
export class InventoryAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list() {
    // Payloads stay encrypted; the panel only sees label/status/relations.
    return this.prisma.inventoryItem.findMany({
      select: {
        id: true,
        label: true,
        status: true,
        reservedOrderId: true,
        deliveredAt: true,
        createdAt: true,
        variant: {
          select: {
            id: true,
            title: true,
            product: { select: { id: true, title: true, category: { select: { id: true, title: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
  }

  @Post()
  async create(@Body() body: unknown, @Req() req: AdminRequest) {
    const data = createSchema.parse(body);
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: data.variantId, isActive: true },
    });
    if (!variant) throw new NotFoundException('Plan not found');
    const created = await this.prisma.inventoryItem.create({
      data: {
        variantId: data.variantId,
        label: data.label,
        payloadEnc: this.inventory.encrypt(data.payload),
      },
    });
    this.audit.log({ adminId: req.admin.id, action: 'inventory.create', entityType: 'InventoryItem', entityId: created.id });
    return { id: created.id, label: created.label, status: created.status };
  }

  /** Available stock can be physically deleted; anything else is retired. */
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: AdminRequest) {
    const item = await this.prisma.inventoryItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException();
    if (item.status === 'available') {
      await this.prisma.inventoryItem.delete({ where: { id } });
      this.audit.log({ adminId: req.admin.id, action: 'inventory.delete', entityType: 'InventoryItem', entityId: id });
      return { deleted: true, mode: 'hard' };
    }
    if (item.status === 'retired') throw new BadRequestException('Already retired');
    await this.prisma.inventoryItem.update({ where: { id }, data: { status: 'retired' } });
    this.audit.log({ adminId: req.admin.id, action: 'inventory.retire', entityType: 'InventoryItem', entityId: id });
    return { deleted: true, mode: 'retired' };
  }
}
