import { Injectable } from '@nestjs/common';
import type { DiscountCode, Prisma } from '@premium-hub/db';
import { PrismaService } from '../../prisma/prisma.service';

export type DiscountValidation =
  | { ok: true; code: DiscountCode }
  | { ok: false; reason: 'not_found' | 'inactive' | 'expired' | 'max_uses' | 'max_uses_per_user' | 'min_order' };

@Injectable()
export class DiscountsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Validate a code for a user and (optionally) an order total. */
  async validate(codeText: string, userId: string, orderTotal?: bigint): Promise<DiscountValidation> {
    const code = await this.prisma.discountCode.findUnique({
      where: { code: codeText.trim().toUpperCase() },
    });
    if (!code) return { ok: false, reason: 'not_found' };
    return this.validateCode(code, userId, orderTotal);
  }

  async validateById(codeId: string, userId: string, orderTotal?: bigint): Promise<DiscountValidation> {
    const code = await this.prisma.discountCode.findUnique({ where: { id: codeId } });
    if (!code) return { ok: false, reason: 'not_found' };
    return this.validateCode(code, userId, orderTotal);
  }

  private async validateCode(
    code: DiscountCode,
    userId: string,
    orderTotal?: bigint,
  ): Promise<DiscountValidation> {
    if (!code.isActive) return { ok: false, reason: 'inactive' };
    if (code.expiresAt && code.expiresAt < new Date()) return { ok: false, reason: 'expired' };
    if (code.maxUses != null) {
      const uses = await this.prisma.discountRedemption.count({ where: { codeId: code.id } });
      if (uses >= code.maxUses) return { ok: false, reason: 'max_uses' };
    }
    if (code.maxUsesPerUser != null) {
      const userUses = await this.prisma.discountRedemption.count({
        where: { codeId: code.id, userId },
      });
      if (userUses >= code.maxUsesPerUser) return { ok: false, reason: 'max_uses_per_user' };
    }
    if (orderTotal != null && code.minOrderTotal != null && orderTotal < code.minOrderTotal) {
      return { ok: false, reason: 'min_order' };
    }
    return { ok: true, code };
  }

  /** Discount amount for a subtotal, never exceeding the subtotal. */
  computeAmount(code: DiscountCode, subtotal: bigint): bigint {
    const raw = code.type === 'percent' ? (subtotal * code.value) / 100n : code.value;
    return raw > subtotal ? subtotal : raw;
  }

  async recordRedemption(
    tx: Prisma.TransactionClient,
    params: { codeId: string; userId: string; orderId: string; amount: bigint },
  ) {
    await tx.discountRedemption.create({ data: params });
  }
}
