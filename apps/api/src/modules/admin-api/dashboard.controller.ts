import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

@UseGuards(AdminAuthGuard)
@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async dashboard() {
    const [
      users,
      webCustomers,
      orders,
      delivered,
      pendingPayments,
      pendingDeliveries,
      openTickets,
      revenue,
      webTopups,
      recentOrders,
      recentPayments,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { phone: { not: null } } }),
      this.prisma.order.count({ where: { status: { not: 'pending_payment' } } }),
      this.prisma.order.count({ where: { status: 'delivered' } }),
      this.prisma.payment.count({ where: { status: 'pending', receipt: { isNot: null } } }),
      this.prisma.delivery.count({ where: { status: 'pending' } }),
      this.prisma.supportTicket.count({ where: { status: 'open' } }),
      this.prisma.order.aggregate({
        _sum: { total: true },
        where: { status: { in: ['paid', 'fulfilling', 'delivered'] } },
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'approved', channel: 'web' },
      }),
      this.prisma.order.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: { user: true, items: true },
      }),
      this.prisma.payment.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: { user: true },
      }),
    ]);
    return {
      counts: { users, webCustomers, orders, delivered, pendingPayments, pendingDeliveries, openTickets },
      revenue: revenue._sum.total ?? 0n,
      webTopups: webTopups._sum.amount ?? 0n,
      recentOrders,
      recentPayments,
    };
  }
}
