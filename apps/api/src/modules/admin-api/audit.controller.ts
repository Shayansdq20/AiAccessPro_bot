import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard, Roles } from '../admin-auth/admin-auth.guard';
import { AuditService } from '../audit/audit.service';

@UseGuards(AdminAuthGuard)
@Roles('owner')
@Controller('admin/audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  async list(@Query('page') page = '1') {
    return this.audit.list(Math.max(1, Number(page) || 1));
  }
}
