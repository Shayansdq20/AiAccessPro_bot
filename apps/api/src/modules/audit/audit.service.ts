import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Fire-and-forget audit record; never blocks or fails the main action. */
  log(entry: {
    adminId?: string | null;
    action: string;
    entityType?: string;
    entityId?: string;
    meta?: Record<string, unknown>;
  }): void {
    void this.prisma.auditLog
      .create({
        data: {
          adminId: entry.adminId ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          meta: entry.meta as never,
        },
      })
      .catch(() => undefined);
  }

  async list(page = 1, pageSize = 50) {
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count(),
    ]);
    return { items, total, page, pageSize };
  }
}
