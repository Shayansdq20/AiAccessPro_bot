import { Injectable } from '@nestjs/common';
import type { Prisma } from '@pro-ai-access/db';
import { decryptPayload, encryptPayload } from '@pro-ai-access/db';
import { PrismaService } from '../../prisma/prisma.service';
import { config } from '../../config';

export interface ClaimedInventory {
  id: string;
  label: string;
  payload: string;
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  encrypt(plaintext: string): string {
    return encryptPayload(plaintext, config.secrets.encryptionKey);
  }

  decrypt(payloadEnc: string): string {
    return decryptPayload(payloadEnc, config.secrets.encryptionKey);
  }

  /**
   * Atomically claim one available item of a variant for an order and mark it
   * delivered. SKIP LOCKED prevents two concurrent orders from taking the
   * same item. Returns null when out of stock.
   */
  async claimForOrder(
    tx: Prisma.TransactionClient,
    variantId: string,
    orderId: string,
  ): Promise<ClaimedInventory | null> {
    const rows = await tx.$queryRaw<{ id: string; label: string; payloadEnc: string }[]>`
      UPDATE "InventoryItem"
      SET status = 'delivered',
          "reservedOrderId" = ${orderId},
          "deliveredAt" = now(),
          "updatedAt" = now()
      WHERE id = (
        SELECT id FROM "InventoryItem"
        WHERE "variantId" = ${variantId} AND status = 'available'
        ORDER BY "createdAt" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, label, "payloadEnc"`;
    const row = rows[0];
    if (!row) return null;
    return { id: row.id, label: row.label, payload: this.decrypt(row.payloadEnc) };
  }

  async availableCount(variantId: string): Promise<number> {
    return this.prisma.inventoryItem.count({ where: { variantId, status: 'available' } });
  }
}
